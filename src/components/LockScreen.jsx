import { useState } from "react";

const LockScreen = ({ onUnlock }) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code === import.meta.env.VITE_ACCESS_CODE) {
      localStorage.setItem("app_unlocked", "true");
      onUnlock();
    } else {
      setError(true);
      setCode("");
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invero</h1>
          <p className="text-gray-600">Unesite pristupni kod</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                error
                  ? "border-red-500 focus:ring-red-200"
                  : "border-gray-300 focus:ring-indigo-200"
              }`}
              placeholder="Pristupni kod"
              autoFocus
            />
            {error && (
              <p className="text-red-500 text-sm mt-2 text-left">
                Neispravan kod
              </p>
            )}
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Otključaj
          </button>
        </form>
      </div>
    </div>
  );
};

export default LockScreen;
