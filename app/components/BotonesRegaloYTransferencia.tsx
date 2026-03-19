"use client";

import { useState } from "react";

export default function BotonesRegaloYTransferencia() {
  const [copiado, setCopiado] = useState(false);

  const codigoEvento = "2102595";

  const linkNoviosFalabella = `https://novios.falabella.com/info-evento/evento?codigoEvento=${codigoEvento}&ref=search`;

  const datos = {
    banco: "Falabella",
    tipoCuenta: "Cuenta corriente",
    numeroCuenta: "1-983-295382-0",
    nombre: "Danyael Vásquez",
    rut: "20.391.039-8",
  };

  const datosTransferencia = `
Banco: ${datos.banco}
Tipo de cuenta: ${datos.tipoCuenta}
Número de cuenta: ${datos.numeroCuenta}
Nombre: ${datos.nombre}
RUT: ${datos.rut}
`.trim();

  const copiarDatos = async () => {
    try {
      await navigator.clipboard.writeText(datosTransferencia);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* ===== Card Novios Falabella ===== */}
      <div className="rounded-2xl bg-white shadow-lg p-8 flex flex-col items-center text-center">
        <span className="text-4xl mb-4">🎁</span>

        <h3 className="font-serif text-2xl mb-2">Lista de regalos</h3>

        <p className="text-sm text-gray-600 mb-6">
          Elige un regalo desde nuestra lista en Novios Falabella.
        </p>

        <a
          href={linkNoviosFalabella}
          target="_blank"
          rel="noopener noreferrer"
          className="
            mt-auto
            inline-block
            px-10 py-4
            rounded-full
            bg-neutral-900
            text-white
            text-xs
            font-bold
            uppercase
            tracking-[0.25em]
            shadow-md
            transition
            hover:brightness-110
            active:scale-[0.97]
          "
        >
          Ver lista
        </a>
      </div>

      {/* ===== Card Transferencia ===== */}
      <div className="rounded-2xl bg-white shadow-lg p-8 flex flex-col text-center">
        <span className="text-4xl mb-4">💛</span>

        <h3 className="font-serif text-2xl mb-2">Transferencia</h3>

        <p className="text-sm text-gray-600 mb-6">
          Si prefieres, puedes apoyarnos mediante transferencia bancaria.
        </p>

        <div className="text-sm text-gray-700 space-y-1 mb-6">
          <p>
            <span className="font-medium">Banco:</span> {datos.banco}
          </p>
          <p>
            <span className="font-medium">Tipo de cuenta:</span>{" "}
            {datos.tipoCuenta}
          </p>
          <p>
            <span className="font-medium">N° de cuenta:</span>{" "}
            {datos.numeroCuenta}
          </p>
          <p>
            <span className="font-medium">Nombre:</span> {datos.nombre}
          </p>
          <p>
            <span className="font-medium">RUT:</span> {datos.rut}
          </p>
        </div>

        <button
          onClick={copiarDatos}
          className="
            mt-auto
            px-10 py-4
            rounded-full
            border border-gray-300
            bg-gray-100
            text-gray-800
            text-xs
            font-bold
            uppercase
            tracking-[0.25em]
            shadow-sm
            transition
            hover:bg-gray-200
            active:scale-[0.97]
          "
        >
          Copiar datos
        </button>

        {copiado && (
          <span className="mt-4 text-xs font-medium text-green-600">
            ✔ Datos copiados al portapapeles
          </span>
        )}
      </div>
    </div>
  );
}
