// Arquivo: frontend-cidadao/src/components/CarrosselAvisos.jsx
import React from "react";
// Importe os componentes do Swiper
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay } from "swiper/modules";

// Importe os estilos do Swiper
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

// Lista de imagens que você colocou na pasta public/avisos
const imagens = [
  "IMG-20251006-WA0033.jpg", // Não Caia no Golpe
  "Imagem do WhatsApp de 2025-10-06 à(s) 17.11.07_7b5c50f5.jpg", // É Baratinho
  "IMG-20251006-WA0029.jpg", // Exemplo de conversa
  "IMG-20251006-WA0030.jpg", // O final da história
  "IMG-20251006-WA0031.jpg", // O que fazer
  "IMG-20251006-WA0032.jpg", // Precisa de ajuda?
  "IMG-20251006-WA0033.jpg", // Não Caia no Golpe
  "IMG-20251006-WA0034.jpg", // Fique Atento
  "IMG-20251006-WA0035.jpg", // Quem pode ser atendido
  "IMG-20251006-WA0036.jpg", // Contatos Oficiais
  "IMG-20251006-WA0037.jpg", // Canais Oficiais
  "IMG-20251006-WA0038.jpg", // Nunca Pague
];

export const CarrosselAvisos = () => {
  return (
    <section className="bg-app p-4 sm:p-6 rounded-2xl border border-soft max-w-3xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4 text-center text-error">
        Fique Atento aos Golpes!
      </h2>
      <Swiper
        modules={[Navigation, Pagination, Autoplay]}
        spaceBetween={30}
        slidesPerView={1}
        autoHeight={true}
        navigation
        pagination={{ clickable: true }}
        loop={true}
        autoplay={{ delay: 4000, disableOnInteraction: false }}
        className="rounded-lg "
      >
        {imagens.map((img, index) => (
          <SwiperSlide key={index}>
            <img
              src={`/avisos/${img}`}
              alt={`Aviso sobre golpes ${index + 1}`}
              className="w-full h-auto max-h-90 sm:max-h-100 md:max-h-100 lg:max-h-[500px] object-contain rounded-lg mx-auto"
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
};
