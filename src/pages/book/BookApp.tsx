import React, { lazy, Suspense } from "react";
import { LinearProgress } from "@mui/material";
import { I18nextProvider } from "react-i18next";
import { Route, Routes, useLocation } from "react-router";

import { BookInfoProvider } from "./BookContext";
import { bookI18n } from "./i18n";

// Публичная витрина онлайн-записи (/book/*) — вне RequireAuth, ходит в /api/v1/public/booking/.
// Свой экземпляр i18n (язык гостя не трогает язык CRM) и один запрос организации на все страницы.
//
//   /book                              выбор филиала (один филиал — сразу он)
//   /book/:branch                      занятия филиала; ?service= — специалисты занятия
//   /book/:branch/specialist/:id       страница специалиста: занятие, день, время, заявка
//   /book/status/:code?                статус заявки / проверка кода
//   /book/me                           «Мои записи»: вход по SMS (только номера KG)
//   /book/payment/result               возврат со страницы банка
// :branch — короткий адрес филиала из настроек записи или его id.

const BranchPickerPage = lazy(() => import("./BranchPickerPage"));
const BranchPage = lazy(() => import("./BranchPage"));
const SpecialistPage = lazy(() => import("./SpecialistPage"));
const BookingStatusPage = lazy(() => import("./BookingStatusPage"));
const MyBookingsPage = lazy(() => import("./MyBookingsPage"));
const PaymentResultRedirect = lazy(() =>
  import("./BookingStatusPage").then((m) => ({ default: m.PaymentResultRedirect })),
);

/** Новая страница витрины открывается сверху, а не с прокруткой прошлой. */
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const BookApp: React.FC = () => (
  <I18nextProvider i18n={bookI18n}>
    <BookInfoProvider>
      <ScrollToTop />
      <Suspense fallback={<LinearProgress />}>
        <Routes>
          <Route index element={<BranchPickerPage />} />
          <Route path="status/:code?" element={<BookingStatusPage />} />
          <Route path="me" element={<MyBookingsPage />} />
          <Route path="payment/result" element={<PaymentResultRedirect />} />
          <Route path=":branchRef" element={<BranchPage />} />
          <Route path=":branchRef/specialist/:specialistId" element={<SpecialistPage />} />
        </Routes>
      </Suspense>
    </BookInfoProvider>
  </I18nextProvider>
);

export default BookApp;
