import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import HomePage from "./pages/HomePage";
import ArtikliPage from "./pages/ArtikliPage";
import StanjePage from "./pages/StanjePage";
import StatistikaPage from "./pages/StatistikaPage";
import "./App.css";

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="py-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/artikli" element={<ArtikliPage />} />
          <Route path="/stanje" element={<StanjePage />} />
          <Route path="/statistika" element={<StatistikaPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
