import { en } from "./en.ts";

type Translation = typeof en;

export const ru: Translation = {
  common: {
    skip: "Пропустить",
    back: "Назад",
    next: "Далее",
    tryAgain: "Повторить",
    uploadPhotoArrow: "Загрузить фото →",
  },
  nav: {
    home: "Главная",
    upload: "Загрузить",
    explore: "Обзор",
    library: "Библиотека",
    profile: "Профиль",
  },
};
