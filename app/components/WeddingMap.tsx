type WeddingMapProps = {
  googleMapsUrl: string;
};

export default function WeddingMap({ googleMapsUrl }: WeddingMapProps) {
  return (
    <section className="py-28 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="font-serif text-4xl mb-6">¿Cómo llegar?</h2>

        <p className="text-sm mb-12 text-gray-600">
          Te dejamos la ubicación para que puedas llegar sin problemas el día de
          la boda.
        </p>

        {/* MAPA BLOQUEADO */}
        <div className="relative rounded-2xl overflow-hidden shadow-lg">
          {/* Overlay para bloquear interacción */}
          <div className="absolute inset-0 z-10 cursor-pointer" />

          <iframe
            title="Mapa de la boda"
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1660.1722581607085!2d-70.72958200160521!3d-33.67414239999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x966320a82211b543%3A0xd22ecaa048bc51a8!2sHacienda%20Los%20Naranjos!5e0!3m2!1ses-419!2scl!4v1771442132745!5m2!1ses-419!2scl"
            className="w-full h-112.5"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        {/* BOTÓN */}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="
            inline-block mt-8
            px-10 py-4
            bg-linear-to-r from-[#bf953f] via-[#d4af37] to-[#aa771c]
            text-white font-bold uppercase tracking-[0.25em] text-xs
            rounded-full shadow-xl
            hover:opacity-90 transition
          "
        >
          Abrir en Google Maps
        </a>
      </div>
    </section>
  );
}
