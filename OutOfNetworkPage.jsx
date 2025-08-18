import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

// This component demonstrates the problematic navigation loop issue
// The original useEffect causes infinite redirects when the page is reloaded
const OutOfNetworkPage = () => {
  const navigate = useNavigate();
  const { id: urlParamId } = useParams();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [subcontractorData, setSubcontractorData] = useState(null);

  // PROBLEMATIC CODE - This causes a navigation loop on page reload
  // When the component mounts with a urlParamId, it immediately navigates
  // to the same URL, causing the component to remount and creating an infinite loop
  /*
  useEffect(() => {
    if (urlParamId) {
      navigate(`/admin/subcontractor/add-subcontractor/${urlParamId}/edit`);
    }
  }, [urlParamId, navigate]);
  */

  // FIXED VERSION - Check if we're already on the edit route to prevent loops
  useEffect(() => {
    // Only navigate if we have an ID but we're NOT already on the edit route
    if (urlParamId && !location.pathname.includes('/edit')) {
      navigate(`/admin/subcontractor/add-subcontractor/${urlParamId}/edit`);
    }
  }, [urlParamId, navigate, location.pathname]);

  // Load subcontractor data when component mounts or ID changes
  useEffect(() => {
    const loadSubcontractorData = async () => {
      if (!urlParamId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        // Simulate API call to load subcontractor data
        // In a real app, this would be an actual API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mockData = {
          id: urlParamId,
          name: `Subcontractor ${urlParamId}`,
          email: `subcontractor${urlParamId}@example.com`,
          phone: '555-0123',
          address: '123 Main St, City, State 12345'
        };
        
        setSubcontractorData(mockData);
      } catch (error) {
        console.error('Error loading subcontractor data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSubcontractorData();
  }, [urlParamId]);

  // Show loading state while data is being fetched
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Loading subcontractor data...</div>
      </div>
    );
  }

  // Show message if no ID is provided
  if (!urlParamId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Add Subcontractor</h1>
        <p>No subcontractor ID provided. Please select a subcontractor to edit.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        {location.pathname.includes('/edit') ? 'Edit' : 'View'} Subcontractor
      </h1>
      
      {subcontractorData && (
        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              <input
                type="text"
                defaultValue={subcontractorData.name}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!location.pathname.includes('/edit')}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                defaultValue={subcontractorData.email}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!location.pathname.includes('/edit')}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              <input
                type="tel"
                defaultValue={subcontractorData.phone}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!location.pathname.includes('/edit')}
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address
              </label>
              <textarea
                defaultValue={subcontractorData.address}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!location.pathname.includes('/edit')}
              />
            </div>
          </div>
          
          {location.pathname.includes('/edit') && (
            <div className="mt-6 flex gap-4">
              <button
                type="button"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => {
                  // Save logic would go here
                  alert('Subcontractor updated successfully!');
                }}
              >
                Save Changes
              </button>
              
              <button
                type="button"
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                onClick={() => navigate('/admin/subcontractors')}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
      
      <div className="mt-6 p-4 bg-green-100 rounded-lg">
        <h3 className="font-medium text-green-800 mb-2">✅ Issue Fixed</h3>
        <p className="text-green-700 text-sm">
          This component now properly handles page reloads without causing navigation loops.
          The useEffect has been modified to check if we're already on the edit route before navigating.
        </p>
      </div>
    </div>
  );
};

export default OutOfNetworkPage;