'use client';

import { useState } from 'react';

interface ApiFormData {
  name: string;
  description: string;
  endpointUrl: string;
  httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE'; // Add more as needed
  // For simplicity, we'll handle parameters as a JSON string for now
  // Later, we can add a more structured way to define parameters
  parametersSchema: string; // e.g., { "query": { "id": "string" }, "body": { "data": "object" } }
  pricePerCall: number; // Price in some unit (e.g., smallest unit of a crypto)
}

export default function AddApiPage() {
  const [formData, setFormData] = useState<ApiFormData>({
    name: '',
    description: '',
    endpointUrl: '',
    httpMethod: 'GET',
    parametersSchema: '{}',
    pricePerCall: 0,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'pricePerCall' ? parseFloat(value) : value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/marketplace/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      // Try to parse JSON, but handle cases where it might not be (e.g. network error HTML page)
      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        // If response is not JSON, try to get text, or use a generic error
        const errorText = await response.text().catch(() => "Invalid response from server.");
        console.error('API submission - Response JSON parse error:', jsonError);
        console.error('API submission - Response text:', errorText);
        setMessage(`Error: Server returned non-JSON response (Status: ${response.status}). ${errorText.substring(0,100)}`);
        setIsLoading(false);
        return;
      }
      
      if (response.ok) {
        setMessage(`API added successfully: ${result.message || 'Success'}`);
        setFormData({
          name: '',
          description: '',
          endpointUrl: '',
          httpMethod: 'GET',
          parametersSchema: '{}',
          pricePerCall: 0,
        });
      } else {
        // Server returned an error, result.error should contain the message from backend
        const errorMsg = result?.error || response.statusText || 'Unknown server error';
        setMessage(`Error adding API: ${errorMsg}`);
        console.error('Error adding API - Server response:', result);
      }
    } catch (error) {
      // Network error or other issues with the fetch call itself
      console.error('Failed to submit API - Network/fetch error:', error);
      const errMsg = error instanceof Error ? error.message : 'An unknown network error occurred.';
      setMessage(`Failed to submit API: ${errMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Add New API to Marketplace</h1>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">API Name</label>
          <input
            type="text"
            name="name"
            id="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            name="description"
            id="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black"
          />
        </div>

        <div>
          <label htmlFor="endpointUrl" className="block text-sm font-medium text-gray-700">Original Endpoint URL</label>
          <input
            type="url"
            name="endpointUrl"
            id="endpointUrl"
            value={formData.endpointUrl}
            onChange={handleChange}
            required
            placeholder="https://api.example.com/data"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black"
          />
        </div>

        <div>
          <label htmlFor="httpMethod" className="block text-sm font-medium text-gray-700">HTTP Method</label>
          <select
            name="httpMethod"
            id="httpMethod"
            value={formData.httpMethod}
            onChange={handleChange}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>

        <div>
          <label htmlFor="parametersSchema" className="block text-sm font-medium text-gray-700">
            Parameters Schema (JSON format, e.g., {`{"query": {"id": "string"} }`})
          </label>
          <textarea
            name="parametersSchema"
            id="parametersSchema"
            value={formData.parametersSchema}
            onChange={handleChange}
            rows={3}
            placeholder='e.g., { "query": { "id": "string" }, "body": { "user": "object" } }'
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black"
          />
        </div>

        <div>
          <label htmlFor="pricePerCall" className="block text-sm font-medium text-gray-700">Price Per Call (e.g., in sats)</label>
          <input
            type="number"
            name="pricePerCall"
            id="pricePerCall"
            value={formData.pricePerCall}
            onChange={handleChange}
            min="0"
            step="any" 
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
        >
          {isLoading ? 'Adding...' : 'Add API to Marketplace'}
        </button>
      </form>
      {message && (
        <div className={`mt-4 p-3 rounded-md ${message.toLowerCase().startsWith('error') || message.toLowerCase().startsWith('failed') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}
    </div>
  );
} 