"use client";
import React, { useState, useEffect, useMemo } from "react";
import LabelPreview from "./LabelPreview";
import LabelBuilder from "./LabelBuilder";
import { formatAuthor, formatCallNumber, generateLabelsHtml } from "../utilities/labelUtils";

const DEFAULT_THEME_OPTIONS = [
  " ",
  "Easy Chapter",
  "Fantasy",
  "Fiction",
  "Graphic",
  "Holiday",
  "Learning",
  "Mystery",
  "Reader",
  "Science Fiction",
  "Steinem",
  "Tatum",
  "Teen",
  "Teen Graphic",
  "Test",
  "Urban",
  "Western",
  "--SERIES--",
  "Series",
  "Mystery",
  "Fiction",
  "Science Fiction",
  "Western",
  "Teen",
   "--LARGE PRINT--",
  "LP - Fiction",
  "LP - Mystery",
  "LP - Science Fiction",
  "LP - Western",
  "--LIT CENTER--",
  "Lit Ctr Lvl 1",
  "Lit Ctr Lvl 2",
  "Lit Ctr Lvl 3",
  "Lit Ctr Lvl 4",
  "Lit Ctr Lvl 5",
  "--LOCAL AUTHORS--",
  "Local Author",
  "Local Author - Fiction",
  "Local Author - Mystery",
  "Local Author - Science Fiction",
  "Local Author - Western",
  "--DECODABLES--",
  "Consonant Blends",
  "Consonant Digraphs",
  "Dyslexia Friendly",
  "Silent E",
  "Initial Sounds",
  "Syllables",
  "Vowel Teams",
  "--WORLD LANGUAGES--",
  "Arabic",
  "Chinese",
  "French",
  "German",
  "Hindi",
  "Italian",
  "Japanese",
  "Korean",
  "Portuguese",
  "Spanish",
];

const CHILDCARE_THEME_OPTIONS = [
  "Board Book",
  "Fiction Preschool",
  "Fiction Reader",
  "NF Preschool",
  "NF Reader",
  "NF School Age",
  "School Age",
];

const DECODABLES_THEME_OPTIONS = [
  "Consonant Blends",
  "Consonant Digraphs",
  "Dyslexia Friendly",
  "Silent E",
  "Initial Sounds",
  "Syllables",
  "Vowel Teams",
];

function MainComponent() {
  //const [activeTab, setActiveTab] = useState("barcode");
  const [activeTab, setActiveTab] = useState("isbn");
  const [singleIsbn, setSingleIsbn] = useState("");
  const [singleUpc, setSingleUpc] = useState("");
  const [singleBarcode, setSingleBarcode] = useState("");
  const [copies, setCopies] = useState("1");
  const [theme, setTheme] = useState("");
  const [defaultTitle, setDefaultTitle] = useState("");
  const [defaultAuthor, setDefaultAuthor] = useState("");
  const [defaultCallNo, setDefaultCallNo] = useState("");
  const [defaultVolume, setDefaultVolume] = useState("");
  const [bulkIsbns, setBulkIsbns] = useState("");
  const [bulkUpcs, setBulkUpcs] = useState("");
  const [bulkBarcodes, setBulkBarcodes] = useState("");
  const [csvData, setCsvData] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [labelFormats, setLabelFormats] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [themeOptions, setThemeOptions] = useState(DEFAULT_THEME_OPTIONS);

  // ✅ UseMemo so month/year updates automatically when component mounts
  const monthYear = useMemo(() => {
    const now = new Date();
    return now.toLocaleString("en-US", { month: "short", year: "2-digit" });
  }, []);

  useEffect(() => {
    if (selectedFormat === "cc-collection") {
      setThemeOptions(CHILDCARE_THEME_OPTIONS);
      setTheme(CHILDCARE_THEME_OPTIONS[0]);
    } else if (selectedFormat === "decodables-top") {
      setThemeOptions(DECODABLES_THEME_OPTIONS);
      setTheme(DECODABLES_THEME_OPTIONS[0]);
    } else {
      setThemeOptions(DEFAULT_THEME_OPTIONS);
      setTheme(DEFAULT_THEME_OPTIONS[0]);
    }
  }, [selectedFormat]);

  useEffect(() => {
    const fetchLabelFormats = async () => {
      try {
        const response = await fetch("/labelFormats.json");
        if (!response.ok) throw new Error("Failed to load label formats.");
        const data = await response.json();
        setLabelFormats(data);
        if (data && Object.keys(data).length > 0) {
          setSelectedFormat(Object.keys(data)[0]);
        }
      } catch (err) {
        setError(err.message);
        console.error("Error fetching label formats:", err);
      }
    };
    fetchLabelFormats();
  }, []);

  const fetchBookData = async (code, type) => {
    try {
      setLoading(true);
      const response = await fetch("/sierra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [type]: code }),
      });

      if (!response.ok) throw new Error(`Failed to fetch book data`);

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      console.log(`${type.toUpperCase()} ${code} - Locations:`, data.locations);
      console.log(
        `${type.toUpperCase()} ${code} - Formatted Location Codes:`,
        data.locationCodes,
      );

      let finalCallNo = data.callNumber || defaultCallNo;
      const finalVolume = data.volume || defaultVolume;

      // Remove volume from call number if present at the end
      if (finalCallNo && finalVolume && typeof finalVolume === "string" && finalVolume.trim()) {
        const trimmedVol = finalVolume.trim();
        const escapedVol = trimmedVol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?:\\s+|\\<br\\>)${escapedVol}$`, "i");
        finalCallNo = finalCallNo.replace(regex, "").trim();
      }

      const finalAuthor = data.author ? formatAuthor(data.author) : defaultAuthor;

      const csvRow = {
        Barcode: data.barcode || "",
        Prefix: data.prefix,
        "Call No.": finalCallNo,
        Volume: finalVolume,
        Author: finalAuthor,
        FullAuthor: data.author || defaultAuthor,
        Title: data.title || defaultTitle,
        "Location code": data.locationCodes || "",
        Copies: copies,
        "Theme/Sticker": theme,
        "Use monthYear": true,
        "Use Series": false,
        //"Chars/Line": 10,
        //"Adjust Label": false,
      };

      if (type !== "barcode") {
        csvRow[type.toUpperCase()] = code;
      }

      setCsvData((prev) => [...prev, csvRow]);
    } catch (err) {
      setError(`Error with ${type.toUpperCase()} ${code}: ${err.message}`);
      console.error(`Error fetching book data for ${type}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleSingleAdd = async () => {
    let code = "", type = "";
    if (activeTab === "isbn" && singleIsbn.trim()) {
      code = singleIsbn.trim(); type = "isbn"; setSingleIsbn("");
    } else if (activeTab === "upc" && singleUpc.trim()) {
      code = singleUpc.trim(); type = "upc"; setSingleUpc("");
    } else if (activeTab === "barcode" && singleBarcode.trim()) {
      code = singleBarcode.trim(); type = "barcode"; setSingleBarcode("");
    }

    if (code) await fetchBookData(code, type);
  };

  const handleBulkAdd = async () => {
    let codes = [], type = "";
    if (activeTab === "isbn") {
      codes = bulkIsbns.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
      type = "isbn"; setBulkIsbns("");
    } else if (activeTab === "upc") {
      codes = bulkUpcs.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
      type = "upc"; setBulkUpcs("");
    } else if (activeTab === "barcode") {
      codes = bulkBarcodes.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
      type = "barcode"; setBulkBarcodes("");
    }
    for (const code of codes) await fetchBookData(code, type);
  };

  const handleAddSpecialLabel = () => {
    const csvRow = {
      Barcode: "",
      Prefix: "",
      "Call No.": "",
      Volume: "",
      Author: "",
      FullAuthor: "",
      Title: "",
      "Location code": "",
      Copies: copies,
      "Theme/Sticker": theme,
      "Use monthYear": true,
      "Use Series": false,
      "Chars/Line": 10,
      "Adjust Label": false,
    };
    setCsvData((prev) => [...prev, csvRow]);
  };

   const handleThemeChange = (rowIndex, value) => {
    setCsvData((prev) => {
      const newData = [...prev];
      const newRow = { ...newData[rowIndex], "Theme/Sticker": value };
      newData[rowIndex] = newRow;
      return newData;
    });
  };

  const updateField = (index, field, value) => {
    setCsvData((prev) => {
      const newData = [...prev];
      newData[index] = { ...newData[index], [field]: value };
      return newData;
    });
  };

  const handleDeleteRow = (index) => {
    setCsvData(prev => prev.filter((_, i) => i !== index));
  };


  const handlePreview = () => {
    const format = labelFormats[selectedFormat];
    let html = generateLabelsHtml(labelFormats, selectedFormat, csvData, monthYear, defaultAuthor, true);
    const previewStyle = `
        <style>
            .long-call-no .field-volume {
                top: 40pt;
            }
            .long-call-no .field-author {
                top: 50pt;
            }
        </style>
    `;
    html = previewStyle + html;
    setPreviewHtml(html);
    setShowPreview(true);
  };

  const printLabels = () => {
  if (!labelFormats) return alert("No label formats available.");
  const format = labelFormats[selectedFormat];
  const labelsHtml = generateLabelsHtml(labelFormats, selectedFormat, csvData, monthYear, defaultAuthor, false);
  const printWindow = window.open("", "_blank");
  if (!printWindow) return alert("Please allow pop-ups to print labels.");

  printWindow.document.title = "Library Labels";

  // Convert width/height from mm to inches for @page
  const widthIn = format.width.endsWith("mm")
    ? (parseFloat(format.width) / 25.4).toFixed(2) + "in"
    : format.width;

  const heightIn = format.height.endsWith("mm")
    ? (parseFloat(format.height) / 25.4).toFixed(2) + "in"
    : format.height;

  const style = printWindow.document.createElement("style");
  style.textContent = `
    @page {
      size: ${widthIn} ${heightIn};
      margin: 0;
    }

    @media print {
      @page {
        size: ${widthIn} ${heightIn};
        orientation: ${format.orientation};
      }
      html, body {
        margin: 0;
        padding: 0;
        width: ${widthIn};
        height: ${heightIn};
      }
    }

    html, body {
      margin: 0;
      padding: 0;
      width: ${widthIn};
      height: ${heightIn};
      font-family: Arial, sans-serif;
      font-weight: 600;
    }

    .label-grid {
      display: block;
    }

    .label {
      width: ${widthIn};
      height: ${heightIn};
      position: relative;
      box-sizing: border-box;
      overflow: hidden;
      page-break-after: always;
    }

    .long-call-no.label .field-volume {
      top: 40pt;
    }

    .long-call-no.label .field-author {
        top: 50pt;
    }

    .label:last-child {
      page-break-after: auto;
    }

    .label-element, .sub-label-container {
      position: absolute;
      box-sizing: border-box;
      transform-origin: top left !important; /* enforce top-left origin */
    }

    .label-element {
      border: 1px dotted transparent;
    }

    .sub-label-container {
      border: 1px solid #9cf;
    }
  `;
  printWindow.document.head.appendChild(style);

  // Inject labels
  printWindow.document.body.innerHTML = `<div class="label-grid">${labelsHtml}</div>`;
  printWindow.document.close();

  printWindow.onload = () => setTimeout(() => printWindow.print(), 500);
};


  const getSingleInputValue =
    () => activeTab === "isbn" ? singleIsbn :
    activeTab === "upc" ? singleUpc : singleBarcode;

  const getBulkInputValue =
    () => activeTab === "isbn" ? bulkIsbns :
    activeTab === "upc" ? bulkUpcs : bulkBarcodes;

  const setSingleInputValue =
    (value) => activeTab === "isbn" ? setSingleIsbn(value) :
    activeTab === "upc" ? setSingleUpc(value) : setSingleBarcode(value);

  const setBulkInputValue =
    (value) => activeTab === "isbn" ? setBulkIsbns(value) :
    activeTab === "upc" ? setBulkUpcs(value) : setBulkBarcodes(value);

  const getTableHeaders = () => {
    if (!csvData || csvData.length === 0) return [];

    const allHeaders = [...new Set(csvData.flatMap((row) => Object.keys(row)))];
    const columnOrder = [
      "Barcode",
      "ISBN",
      "UPC",
      "Prefix",
      "Call No.",
      "Volume",
      "Author",
      "Title",
      "Location code",
      "Copies",
      "Chars/Line",
      "Theme/Sticker",
      "Use monthYear",
      "Use Series",
      "Adjust Label",
    ];

    const orderedHeaders = columnOrder.filter((h) => allHeaders.includes(h));
    const extraHeaders = allHeaders.filter((h) => !orderedHeaders.includes(h));

    const hiddenHeaders = ["Use Series", "FullAuthor"];

    return [...orderedHeaders, ...extraHeaders].filter(h => !hiddenHeaders.includes(h));
  };

  const tableHeaders = csvData.length > 0 ? getTableHeaders() : [];

  const livePreviewHtml = useMemo(() => {
    if (!labelFormats || !selectedFormat || csvData.length === 0) return "";
    const html = generateLabelsHtml(labelFormats, selectedFormat, csvData, monthYear, defaultAuthor, true);

    // Include preview specific styles
    const previewStyle = `
        <style>
            .long-call-no .field-volume {
                top: 40pt;
            }
            .long-call-no .field-author {
                top: 50pt;
            }
        </style>
    `;
    return previewStyle + html;
  }, [labelFormats, selectedFormat, csvData, monthYear, defaultAuthor]);


  return (
    <div className="p-2 sm:p-6 md:p-6 bg-gray-50 min-h-screen">
    <div className="max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Labels</h1>
        <p className="text-gray-600">Create and print labels for library items.</p>
      </header>

      {/* Label Format Selection */}
      <div className="mb-6 p-4 bg-white rounded-lg shadow flex justify-between items-center flex-wrap gap-4">
          <div>
            <label htmlFor="label-format" className="block text-sm font-medium text-gray-700 mb-2">
              Label Format
            </label>
            <select
              id="label-format"
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="w-full sm:w-auto p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {labelFormats ? (
                Object.entries(labelFormats).map(([key, format]) => (
                  <option key={key} value={key}>
                    {format.name}
                  </option>
                ))
              ) : (
                <option>Loading formats...</option>
              )}
            </select>
          </div>
          <button 
            onClick={() => setShowBuilder(true)}
            className="invisible px-4 py-2 bg-indigo-600 text-white font-medium rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Create Custom Label
          </button>
        </div>

      {/* Input Section */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        {selectedFormat === "cc-collection" || selectedFormat === "decodables-top" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Theme/Sticker
                </label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  {themeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Copies
                </label>
                <input
                  type="number"
                  min="1"
                  value={copies}
                  onChange={(e) => setCopies(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleAddSpecialLabel}
                className="md:w-auto px-4 py-2 bg-blue-600 text-white font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Add Label
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b mb-6">
              {["isbn", "barcode", "upc"].map(tab => (
                <button
                  key={tab}
                  className={`px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                    activeTab === tab
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-500 hover:text-gray-800 hover:border-gray-300 border-b-2 border-transparent"
                  }`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="space-y-6">
              {/* Single input with copies and theme */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {activeTab.toUpperCase()}
                  </label>
                  <input
                    type="text"
                    value={getSingleInputValue()}
                    onChange={(e) => setSingleInputValue(e.target.value)}
                    placeholder={`Enter single ${activeTab.toUpperCase()}`}
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    onKeyPress={(e) => e.key === "Enter" && handleSingleAdd()}
                  />
                </div>
                <button
                  onClick={handleSingleAdd}
                  disabled={loading || !getSingleInputValue().trim()}
                  className=" md:w-auto px-4 py-2 bg-blue-600 text-white font-medium rounded-md shadow-sm hover:bg-blue-700 focus:ou
tline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed"
                >
                  Add Item
                </button>
              </div>

              {/* Bulk input */}
              <div className="hidden">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bulk {activeTab.toUpperCase()}s (one per line or comma-separated)
                </label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <textarea
                    value={getBulkInputValue()}
                    onChange={(e) => setBulkInputValue(e.target.value)}
                    placeholder={`Enter multiple ${activeTab.toUpperCase()}s...`}
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm h-24 focus:ring-blue-500 focus:border-blue-500
"
                  />
                  <button
                    onClick={handleBulkAdd}
                    disabled={loading || !getBulkInputValue().trim()}
                    className="px-4 py-2 bg-green-600 text-white font-medium rounded-md shadow-sm hover:bg-green-700 focus:outline-n
one focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-300 disabled:cursor-not-allowed"
                  >
                    Add Bulk
                  </button>
                </div>
              </div>
              {error && (
                <div className="text-red-600 p-3 bg-red-50 border border-red-200 rounded-md">{error}</div>
              )}
            </div>
          </>
        )}
      </div>

      {csvData.length > 0 && (
        <>
        {/* Live Preview Section */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Live Preview</h2>
          <div className="overflow-x-auto p-4 border rounded bg-gray-50 flex flex-wrap gap-4" style={{ maxHeight: '400px' }}>
            <div dangerouslySetInnerHTML={{ __html: livePreviewHtml }} />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Label queue to print</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  {tableHeaders.map((header) => (
                    <th key={header} className="p-3 text-left text-sm font-semibold text-gray-600 border-b">
                      {header}
                    </th>
                  ))}
                  <th className="p-3 text-left text-sm font-semibold text-gray-600 border-b">Actions</th>
                </tr>
              </thead>
              <tbody>
                {csvData.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-gray-50">
                    {tableHeaders.map((header) => (
                      <td key={header} className="p-2 border-b border-gray-200">
                        {header === "Use monthYear" || header === "Use Series" || header === "Adjust Label" ? (
                          <input
                            type="checkbox"
                            checked={row[header]}
                            onChange={(e) =>
                              updateField(rowIndex, header, e.target.checked)
                            }
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        ) : [
                          "Title",
                          "Author",
                          "Call No.",
                          "Volume",
                          "Copies",
                          "Chars/Line",
                          "Theme/Sticker",
                          "Location code",
                        ].includes(header) ? (
                          header === "Theme/Sticker" ? (
                            <select
                              value={row[header]}
                              onChange={(e) =>
  handleThemeChange(rowIndex, e.target.value)
}
                              className="w-full p-1 border border-gray-300 rounded-md text-sm"
                            >
                              {themeOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={header === "Copies" || header === "Chars/Line" ? "number" : "text"}
                              min={header === "Copies" || header === "Chars/Line" ? "1" : undefined}
                              value={row[header]}
                              onChange={(e) =>
                                updateField(rowIndex, header, e.target.value)
                              }
                              className={`w-full p-1 border border-gray-300 rounded-md text-sm ${
                                [
                                  "Title",
                                  "Author",
                                  "Volume",
                                  "Location code",
                                ].includes(header) || ((header === "Call No." || header === "Chars/Line") && !row["Adjust Label"])
                                  ? "bg-gray-100"
                                  : ""
                              }`}
                              disabled={
                                [
                                  "Title",
                                  "Author",
                                  "Volume",
                                  "Location code",
                                ].includes(header) || ((header === "Call No." || header === "Chars/Line") && !row["Adjust Label"])
                              }
                            />
                          )
                        ) : (
                          <span className="text-sm text-gray-800">{row[header]}</span>
                        )}
                      </td>
                    ))}
                    <td className="p-2 border-b border-gray-200 text-center">
                      <button
                        onClick={() => handleDeleteRow(rowIndex)}
                        className="px-3 py-1 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 focus:outline
-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-6">
      
            <button
              onClick={printLabels}
              disabled={!labelFormats}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none
focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
            >
              Print Labels
            </button>
          </div>
        </div>
        </>
      )}

      {showPreview && (
        <LabelPreview
          htmlContent={previewHtml}
          onClose={() => setShowPreview(false)}
          onPrint={() => {
            setShowPreview(false);
            printLabels();
          }}
        />
      )}
      
      {showBuilder && (
        <LabelBuilder
          onCancel={() => setShowBuilder(false)}
          onSave={(key, format) => {
            setLabelFormats(prev => ({ ...prev, [key]: format }));
            setSelectedFormat(key);
            setShowBuilder(false);
          }}
        />
      )}
    </div>
    </div>
  );
}

export default MainComponent;