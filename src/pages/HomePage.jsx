import ExcelUploader from "../components/ExcelUploader";

function HomePage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
      <h1 className="text-4xl font-bold text-gray-800">Dobrodošli!</h1>
      <ExcelUploader />
    </div>
  );
}

export default HomePage;
