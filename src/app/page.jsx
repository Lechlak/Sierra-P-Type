"use client";
import React, { useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const patronTypes = [
  { value: "16", label: "Organization" },
  { value: "23", label: "Childcare" },
  { value: "25", label: "Home Delivery" },
  { value: "37", label: "Mobile Organization" }
].filter(p => p.label !== "").sort((a, b) => a.label.localeCompare(b.label));

function MainComponent() {
  const [queryType, setQueryType] = useState("pType");
  const [pType, setPType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [patrons, setPatrons] = useState([]);
  const [progress, setProgress] = useState("");

  const handleFetch = async () => {
    if (queryType === "pType" && !pType.trim()) {
      setError("Please select a Patron Type (P-Type)");
      return;
    }

    setLoading(true);
    setError("");
    setPatrons([]);
    setProgress("Fetching patrons... This may take a while depending on the number of records.");

    try {
      const payload =
        queryType === "banned_suspended"
          ? { queryType: "banned_suspended" }
          : { queryType: "pType", pType };

      const response = await fetch("/sierra", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch patrons");
      }

      const data = await response.json();
      const fetchedPatrons = data.patrons || [];
      setPatrons(fetchedPatrons);
      setProgress(`Found ${data.count !== undefined ? data.count : fetchedPatrons.length} patron(s).`);
    } catch (err) {
      console.error(err);
      setError(err.message || "An unexpected error occurred");
      setProgress("");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (patrons.length === 0) return;

    // Flatten patron data for Excel
    const excelData = patrons.map((patron) => {
      const name = patron.names && patron.names.length > 0 ? patron.names[0] : "";
      const barcode = patron.barcodes && patron.barcodes.length > 0 ? patron.barcodes[0] : "";
      const email = patron.emails && patron.emails.length > 0 ? patron.emails[0] : "";
      const phone = patron.phones && patron.phones.length > 0 ? patron.phones[0].number : "";
      const expirationDate = patron.expirationDate || "";
      const patronType = patron.patronType !== undefined ? patron.patronType : pType;

      return {
        Name: name,
        Barcode: barcode,
        Email: email,
        Phone: phone,
        "Expiration Date": expirationDate,
        "P-Type": patronType,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Patrons");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/octet-stream" });
    const filename =
      queryType === "banned_suspended"
        ? "Patrons_Banned_Suspended.xlsx"
        : `Patrons_PType_${pType}.xlsx`;
    saveAs(data, filename);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans text-gray-900">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center sm:text-left">
          Patron Data Exporter
        </h1>

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow mb-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Query Type
            </label>
            <div className="flex flex-wrap gap-4 mb-2">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="queryType"
                  value="pType"
                  checked={queryType === "pType"}
                  onChange={() => setQueryType("pType")}
                  className="form-radio text-blue-600 h-4 w-4"
                />
                <span className="ml-2 text-sm text-gray-800">By Patron Type (P-Type)</span>
              </label>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="queryType"
                  value="banned_suspended"
                  checked={queryType === "banned_suspended"}
                  onChange={() => setQueryType("banned_suspended")}
                  className="form-radio text-blue-600 h-4 w-4"
                />
                <span className="ml-2 text-sm text-gray-800">Banned or Suspended Patrons</span>
              </label>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-end mb-4">
            {queryType === "pType" ? (
              <div className="flex-grow">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patron Type (P-Type)
                </label>
                <select
                  value={pType}
                  onChange={(e) => setPType(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                  onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                >
                  <option value="" disabled>Select a Patron Type</option>
                  {patronTypes.map((pt) => (
                    <option key={pt.value} value={pt.value}>
                      {pt.label} ({pt.value})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex-grow p-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
                Queries all patrons with a message in their account containing &quot;banned&quot; or &quot;suspended&quot; (tag m).
              </div>
            )}
            <button
              onClick={handleFetch}
              disabled={loading || (queryType === "pType" && !pType.trim())}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {loading ? "Fetching..." : "Fetch Patrons"}
            </button>
          </div>

          {error && (
            <div className="text-red-600 p-3 bg-red-50 border border-red-200 rounded-md mb-4">
              {error}
            </div>
          )}

          {progress && !error && (
            <div className="text-blue-600 p-3 bg-blue-50 border border-blue-200 rounded-md mb-4">
              {progress}
            </div>
          )}
        </div>

        {patrons.length > 0 && (
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Patron Preview (First 100)
              </h2>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-green-600 text-white font-medium rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Export to Excel
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left text-sm font-semibold text-gray-600">Name</th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-600">Barcode</th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-600">Email</th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-600">Phone</th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-600">Expiration</th>
                    <th className="p-3 text-left text-sm font-semibold text-gray-600">P-Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {patrons.slice(0, 100).map((patron, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="p-3 text-sm text-gray-800">
                        {patron.names && patron.names.length > 0 ? patron.names[0] : "-"}
                      </td>
                      <td className="p-3 text-sm text-gray-800">
                        {patron.barcodes && patron.barcodes.length > 0 ? patron.barcodes[0] : "-"}
                      </td>
                      <td className="p-3 text-sm text-gray-800">
                        {patron.emails && patron.emails.length > 0 ? patron.emails[0] : "-"}
                      </td>
                      <td className="p-3 text-sm text-gray-800">
                        {patron.phones && patron.phones.length > 0 ? patron.phones[0].number : "-"}
                      </td>
                      <td className="p-3 text-sm text-gray-800">
                        {patron.expirationDate || "-"}
                      </td>
                      <td className="p-3 text-sm text-gray-800">
                        {patron.patronType !== undefined ? patron.patronType : (pType || "-")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {patrons.length > 100 && (
              <div className="mt-4 text-sm text-gray-500 italic">
                Showing first 100 of {patrons.length} records. Export to see all.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MainComponent;
