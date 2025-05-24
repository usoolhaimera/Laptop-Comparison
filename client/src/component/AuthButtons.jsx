import React from "react";
import { Link } from 'react-router-dom';

const AuthButtons = () => {
  return (
    <div className="flex items-center justify-center space-x-3 bg-[#333333] p-2 rounded-lg">
      <Link to="/login" className="flex-1 sm:flex-none"> 
        <button className="w-full px-4 py-1.5 text-sm font-medium text-white bg-gray-600 border border-gray-800 rounded-md hover:bg-gray-900 hover:border-gray-800 active:bg-gray-800 transition-all duration-200 min-w-[90px]">
          Login
        </button>
      </Link>
      
      <Link to="/signup" className="flex-1 sm:flex-none">
        <button className="w-full px-4 py-1.5 text-sm font-medium text-white bg-gray-600 border border-gray-800 rounded-md hover:bg-gray-900 hover:border-gray-800 active:bg-gray-800 transition-all duration-200 shadow-md min-w-[90px]">
          Sign Up
        </button>
      </Link>
    </div>
  );
};

export default AuthButtons;
