import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import LaptopSearch from "./LaptopSearch";
import { Menu, X } from "lucide-react"; // You may need to install lucide-react
import AuthButtons from "./AuthButtons"; // Adjust the import path as necessary


const CompareComponent = () => {
  const [laptop1, setLaptop1] = useState({ id: null, name: "" });
  const [laptop2, setLaptop2] = useState({ id: null, name: "" });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleCompare = () => {
    console.log(laptop1.id, laptop2.id);
    if (laptop1.id && laptop2.id) {
      navigate(`/compare/${laptop1.id}/${laptop2.id}`);
    }
  };

  return (
    <nav className="bg-[#333333] shadow-md px-4 py-2 md:p-4">
      <div className="container mx-auto">
        {/* Desktop and Mobile Layout */}
        <div className="flex flex-col lg:flex-row justify-between items-center">
          {/* Logo and Hamburger Menu */}
          <div className="w-full flex justify-between items-center">
            <Link to="/homePage" className="text-xl md:text-2xl font-bold text-slate-300">
              Laptop Comparison
            </Link>
            
            {/* Mobile Menu Button */}
            <button 
              className="lg:hidden focus:outline-none"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Navigation Elements */}
          <div className={`${isMenuOpen ? 'flex' : 'hidden'} lg:flex flex-col lg:flex-row w-full lg:w-auto items-center mt-4 lg:mt-0 space-y-4 lg:space-y-0 lg:space-x-4`}>
            <div className="flex flex-col md:flex-row w-full gap-2 md:gap-4">
              <LaptopSearch
                placeholder="Search Laptop 1"
                onSelectLaptop={setLaptop1}
                className="w-full"
              />
              <LaptopSearch
                placeholder="Search Laptop 2"
                onSelectLaptop={setLaptop2}
                className="w-full"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row w-full md:w-auto gap-2 md:gap-4">
              <button
                onClick={handleCompare}
                disabled={!laptop1.id || !laptop2.id}
                className={`px-4 py-2 rounded-md transition duration-300 ${
                  laptop1.id && laptop2.id 
                    ? "bg-blue-600 hover:bg-blue-700 text-white" 
                    : "bg-gray-300 cursor-not-allowed text-gray-500"
                } w-full sm:w-auto`}
              >
                Compare
              </button>
              <div className="w-full sm:w-auto">
                <AuthButtons />
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default CompareComponent;