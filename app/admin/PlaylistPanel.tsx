"use client";

import { useEffect, useState } from "react";

interface Song {
  songId: string;
  title: string;
  artist: string;
  category: string;
  subcategory: string | null;
  durationSecs: number;
  votes: number;
  votedBy: string[];
  notes: string | null;
  youtubeUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function formatDuration(totalSecs: number): string {
  if (totalSecs === 0) return "—";
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseDurationInput(val: string): number {
  const parts = val.split(":").map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

function secsToInput(secs: number): string {
  if (secs === 0) return "";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function sumDuration(songs: Song[]): number {
  return songs.reduce((acc, s) => acc + (s.durationSecs ?? 0), 0);
}

const CATEGORIES: Record<string, string[]> = {
  Ceremonia: ["Entrada novio", "Entrada novia", "Ritos", "Salida novios del altar"],
  Cóctel: ["Entrada cóctel", "Música cóctel"],
  "Salón principal": ["Entrada salón", "Vals", "Música cena"],
  Fiesta: ["Música inicio fiesta especial novios", "Música fiesta"],
};

const CATEGORY_KEYS = Object.keys(CATEGORIES);

type EditingSong = {
  songId: string;
  title: string;
  artist: string;
  category: string;
  subcategory: string;
  notes: string;
  youtubeUrl: string;
  duration: string;
};

export default function PlaylistPanel({ username }: { username: string }) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [category, setCategory] = useState(CATEGORY_KEYS[0]);
  const [subcategory, setSubcategory] = useState("");
  const [notes, setNotes] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [duration, setDuration] = useState("");
  const [adding, setAdding] = useState(false);

  // Expanded player
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState<EditingSong | null>(null);
  const [saving, setSaving] = useState(false);

  // Filter
  const [filterCategory, setFilterCategory] = useState("");
  const [filterText, setFilterText] = useState("");

  // Voting in progress
  const [votingId, setVotingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/playlist")
      .then((r) => r.json())
      .then((data) => {
        setSongs(data.songs ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("Error al cargar las canciones");
        setLoading(false);
      });
  }, []);

  const filtered = songs
    .filter((s) => {
      if (filterCategory && s.category !== filterCategory) return false;
      if (filterText) {
        const q = filterText.toLowerCase();
        return (
          s.title.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q) ||
          (s.subcategory?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    })
    .sort((a, b) => b.votes - a.votes);

  const songsByCategory = CATEGORY_KEYS.reduce(
    (acc, cat) => {
      acc[cat] = filtered.filter((s) => s.category === cat);
      return acc;
    },
    {} as Record<string, Song[]>
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !artist.trim()) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/admin/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          artist,
          category,
          subcategory: subcategory || null,
          durationSecs: parseDurationInput(duration),
          notes: notes || null,
          youtubeUrl: youtubeUrl || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Error al agregar");
        return;
      }
      const { song } = await res.json();
      setSongs((prev) => [...prev, song]);
      setTitle("");
      setArtist("");
      setSubcategory("");
      setNotes("");
      setYoutubeUrl("");
      setDuration("");
    } catch {
      setError("Error de conexión");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggleVote(songId: string) {
    setVotingId(songId);
    try {
      const res = await fetch(`/api/admin/playlist/${songId}/vote`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const { song } = await res.json();
        setSongs((prev) => prev.map((s) => (s.songId === songId ? song : s)));
      }
    } finally {
      setVotingId(null);
    }
  }

  async function handleDelete(songId: string) {
    if (!confirm("¿Eliminar esta canción?")) return;
    try {
      const res = await fetch("/api/admin/playlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId }),
      });
      if (res.ok) {
        setSongs((prev) => prev.filter((s) => s.songId !== songId));
        if (editing?.songId === songId) setEditing(null);
      }
    } catch {
      setError("Error al eliminar");
    }
  }

  function startEdit(song: Song) {
    setEditing({
      songId: song.songId,
      title: song.title,
      artist: song.artist,
      category: song.category,
      subcategory: song.subcategory ?? "",
      notes: song.notes ?? "",
      youtubeUrl: song.youtubeUrl ?? "",
      duration: secsToInput(song.durationSecs ?? 0),
    });
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/playlist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songId: editing.songId,
          title: editing.title,
          artist: editing.artist,
          category: editing.category,
          subcategory: editing.subcategory || null,
          durationSecs: parseDurationInput(editing.duration),
          notes: editing.notes || null,
          youtubeUrl: editing.youtubeUrl || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Error al guardar");
        return;
      }
      const { song } = await res.json();
      setSongs((prev) => prev.map((s) => (s.songId === song.songId ? song : s)));
      setEditing(null);
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Add song form */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="font-serif text-lg mb-4 text-[#5c4a2e]">Agregar canción</h3>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Título *
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nombre de la canción"
                className="border border-gray-300 rounded px-3 py-2"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Artista *
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Artista o banda"
                className="border border-gray-300 rounded px-3 py-2"
                required
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Categoría *
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setSubcategory("");
                }}
                className="border border-gray-300 rounded px-3 py-2"
              >
                {CATEGORY_KEYS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Subcategoría
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2"
              >
                <option value="">Sin subcategoría</option>
                {CATEGORIES[category]?.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Link de YouTube (opcional)
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="border border-gray-300 rounded px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Duración (m:ss)
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="3:45"
                className="border border-gray-300 rounded px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Notas (opcional)
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: versión acústica, para el brindis..."
                className="border border-gray-300 rounded px-3 py-2"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={adding || !title.trim() || !artist.trim()}
            className="px-5 py-2 bg-[#bf953f] text-white text-sm rounded-lg hover:bg-[#aa771c] transition disabled:opacity-50"
          >
            {adding ? "Agregando…" : "Agregar canción"}
          </button>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm px-4 py-2 rounded-lg bg-red-50 text-red-700">
          {error}
        </div>
      )}

      {/* Stats + durations */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="font-serif text-lg mb-4 text-[#5c4a2e]">Resumen de tiempos</h3>

        {/* Global totals */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-[#fdfaf6] rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-[#bf953f]">{songs.length}</p>
            <p className="text-xs text-gray-500">Canciones</p>
            <p className="text-sm font-medium text-[#5c4a2e] mt-1">
              {formatDuration(sumDuration(songs))}
            </p>
          </div>
          {CATEGORY_KEYS.map((cat) => {
            const catSongs = songs.filter((s) => s.category === cat);
            return (
              <div key={cat} className="bg-[#fdfaf6] rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-[#8a6d3b]">{catSongs.length}</p>
                <p className="text-xs text-gray-500">{cat}</p>
                <p className="text-sm font-medium text-[#5c4a2e] mt-1">
                  {formatDuration(sumDuration(catSongs))}
                </p>
              </div>
            );
          })}
        </div>

        {/* Subcategory breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CATEGORY_KEYS.map((cat) => {
            const catSongs = songs.filter((s) => s.category === cat);
            if (catSongs.length === 0) return null;
            const subs = CATEGORIES[cat];
            return (
              <div key={cat} className="text-sm">
                <p className="font-medium text-[#5c4a2e] mb-1">{cat}</p>
                <div className="space-y-0.5">
                  {subs.map((sub) => {
                    const subSongs = catSongs.filter((s) => s.subcategory === sub);
                    if (subSongs.length === 0) return null;
                    return (
                      <div key={sub} className="flex justify-between text-gray-600 pl-3">
                        <span>{sub}</span>
                        <span className="font-mono text-xs text-[#8a6d3b]">
                          {subSongs.length} · {formatDuration(sumDuration(subSongs))}
                        </span>
                      </div>
                    );
                  })}
                  {/* Songs without subcategory */}
                  {catSongs.filter((s) => !s.subcategory).length > 0 && (
                    <div className="flex justify-between text-gray-400 pl-3 italic">
                      <span>Sin subcategoría</span>
                      <span className="font-mono text-xs">
                        {catSongs.filter((s) => !s.subcategory).length} ·{" "}
                        {formatDuration(sumDuration(catSongs.filter((s) => !s.subcategory)))}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
        >
          <option value="">Todas las categorías</option>
          {CATEGORY_KEYS.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Buscar por título o artista..."
          className="border border-gray-300 rounded px-3 py-2 text-sm w-56"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <span className="text-sm text-gray-400">
          {filtered.length} canción{filtered.length !== 1 ? "es" : ""}
        </span>
      </div>

      {/* Song list by category */}
      {loading ? (
        <p className="text-center text-gray-400 py-10">Cargando…</p>
      ) : songs.length === 0 ? (
        <p className="text-center text-gray-400 py-10">
          No hay canciones todavía. Agrega la primera arriba.
        </p>
      ) : (
        <div className="space-y-6">
          {CATEGORY_KEYS.filter(
            (cat) => !filterCategory || filterCategory === cat
          ).map((cat) => {
            const catSongs = songsByCategory[cat];
            if (catSongs.length === 0) return null;

            return (
              <div key={cat}>
                <h3 className="font-serif text-lg text-[#5c4a2e] mb-3 border-b border-[#e8d9c0] pb-1">
                  {cat}
                  <span className="text-sm font-normal text-gray-400 ml-2">
                    ({catSongs.length})
                  </span>
                </h3>
                <div className="space-y-2">
                  {catSongs.map((song) => {
                    const ytId = song.youtubeUrl ? extractYoutubeId(song.youtubeUrl) : null;
                    const isPlaying = playingId === song.songId;
                    const hasVoted = (song.votedBy ?? []).includes(username);

                    return (
                      <div
                        key={song.songId}
                        className="bg-white rounded-lg shadow-sm overflow-hidden"
                      >
                        <div className="p-4 flex items-center gap-4">
                          {/* Vote toggle */}
                          <button
                            onClick={() => handleToggleVote(song.songId)}
                            disabled={votingId === song.songId}
                            className={`flex flex-col items-center gap-0.5 shrink-0 transition disabled:opacity-40 ${
                              hasVoted
                                ? "text-[#bf953f]"
                                : "text-gray-300 hover:text-[#bf953f]"
                            }`}
                            title={hasVoted ? "Quitar voto" : "Votar"}
                          >
                            <span className="text-xl leading-none">
                              {hasVoted ? "★" : "☆"}
                            </span>
                            <span className="text-xs font-bold text-[#5c4a2e]">
                              {song.votes}
                            </span>
                          </button>

                          {/* Song info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="font-medium text-[#5c4a2e] truncate">
                                {song.title}
                              </span>
                              <span className="text-sm text-[#8a6d3b]">
                                — {song.artist}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {song.subcategory && (
                                <span className="text-xs bg-[#f5edd6] text-[#8a6d3b] px-2 py-0.5 rounded-full">
                                  {song.subcategory}
                                </span>
                              )}
                              {song.durationSecs > 0 && (
                                <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                  {formatDuration(song.durationSecs)}
                                </span>
                              )}
                              {song.notes && (
                                <span className="text-xs text-gray-400 italic truncate">
                                  {song.notes}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {ytId && (
                              <button
                                onClick={() => setPlayingId(isPlaying ? null : song.songId)}
                                className={`text-xs px-2 py-1 rounded transition ${
                                  isPlaying
                                    ? "bg-red-100 text-red-600"
                                    : "bg-red-50 text-red-500 hover:bg-red-100"
                                }`}
                                title={isPlaying ? "Cerrar video" : "Ver video"}
                              >
                                {isPlaying ? "Cerrar ✕" : "▶ YouTube"}
                              </button>
                            )}
                            <button
                              onClick={() => startEdit(song)}
                              className="text-xs text-[#8a6d3b] hover:text-[#5c4a2e] transition"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(song.songId)}
                              className="text-xs text-red-400 hover:text-red-600 transition"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>

                        {/* YouTube embed */}
                        {isPlaying && ytId && (
                          <div className="px-4 pb-4">
                            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                              <iframe
                                src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
                                title={song.title}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="absolute inset-0 w-full h-full rounded-lg"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-white rounded-xl p-6 w-full max-w-md space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-lg text-[#5c4a2e]">Editar canción</h3>

            <label className="flex flex-col gap-1 text-sm">
              Título
              <input
                type="text"
                value={editing.title}
                onChange={(e) =>
                  setEditing((prev) => prev && { ...prev, title: e.target.value })
                }
                className="border border-gray-300 rounded px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Artista
              <input
                type="text"
                value={editing.artist}
                onChange={(e) =>
                  setEditing((prev) => prev && { ...prev, artist: e.target.value })
                }
                className="border border-gray-300 rounded px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Categoría
              <select
                value={editing.category}
                onChange={(e) =>
                  setEditing((prev) =>
                    prev && { ...prev, category: e.target.value, subcategory: "" }
                  )
                }
                className="border border-gray-300 rounded px-3 py-2"
              >
                {CATEGORY_KEYS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Subcategoría
              <select
                value={editing.subcategory}
                onChange={(e) =>
                  setEditing((prev) => prev && { ...prev, subcategory: e.target.value })
                }
                className="border border-gray-300 rounded px-3 py-2"
              >
                <option value="">Sin subcategoría</option>
                {CATEGORIES[editing.category]?.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Link de YouTube
              <input
                type="url"
                value={editing.youtubeUrl}
                onChange={(e) =>
                  setEditing((prev) => prev && { ...prev, youtubeUrl: e.target.value })
                }
                placeholder="https://www.youtube.com/watch?v=..."
                className="border border-gray-300 rounded px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Duración (m:ss)
              <input
                type="text"
                value={editing.duration}
                onChange={(e) =>
                  setEditing((prev) => prev && { ...prev, duration: e.target.value })
                }
                placeholder="3:45"
                className="border border-gray-300 rounded px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Notas
              <input
                type="text"
                value={editing.notes}
                onChange={(e) =>
                  setEditing((prev) => prev && { ...prev, notes: e.target.value })
                }
                className="border border-gray-300 rounded px-3 py-2"
              />
            </label>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editing.title.trim() || !editing.artist.trim()}
                className="px-4 py-2 bg-[#bf953f] text-white text-sm rounded-lg hover:bg-[#aa771c] transition disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
