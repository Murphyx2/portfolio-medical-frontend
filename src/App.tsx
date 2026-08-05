import { useTranslation } from "react-i18next";
import { Route, Routes } from "react-router-dom";

function Dashboard() {
  const { t } = useTranslation();
  return (
    <main className="shell">
      <h1>{t("app.name")}</h1>
      <p>{t("nav.dashboard")}</p>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
    </Routes>
  );
}
