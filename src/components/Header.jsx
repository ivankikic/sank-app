import { Link } from "react-router-dom";

function Header() {
  return (
    <header className="bg-gray-800 text-white h-16">
      <nav className="container mx-auto h-full px-4">
        <ul className="flex items-center h-full space-x-6">
          <li>
            <Link to="/" className="hover:text-gray-300 transition-colors">
              Home
            </Link>
          </li>
          <li>
            <Link
              to="/artikli"
              className="hover:text-gray-300 transition-colors"
            >
              Artikli
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export default Header;
