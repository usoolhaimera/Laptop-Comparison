import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",  // Keep this as username to match server expectations
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevFormData) => ({
      ...prevFormData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate username and password
    if (!formData.username || !formData.password) {  // Changed from email to username
      setError("Username and password are required");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post('http://localhost:8080/api/login', {
        username: formData.username,  // Changed from email to username
        password: formData.password
      },{
        withCredentials: true,
      });

      if (response.data.success) {
        // Store token if your API returns one
        if (response.data.token) {
          localStorage.setItem("token", response.data.token);
        }
        // Redirect to dashboard or home page
        navigate("/homePage");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(err.response?.data?.message || "Failed to login. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/homePage");
    }
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="max-w-sm w-full bg-white p-8 rounded-md shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Login</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="username" className="block font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              id="username"
              name="username"  // Changed from email to username
              type="text"      // Changed from email to text
              value={formData.username}  // Changed from email to username
              onChange={handleInputChange}
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500"
              placeholder="Enter your username"
            />
          </div>
          <div>
            <label htmlFor="password" className="block font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500"
              placeholder="Enter your password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white py-2 rounded transition ${
              loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>
        <p className="text-center mt-4 text-gray-600">
          <a href="#" className="text-blue-500 hover:underline">
            Forgot your password?
          </a>
        </p>
      </div>
    </div>
  );
};

export default Login;