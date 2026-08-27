async function handler({ isbn, upc, barcode }) {
  // Check that at least one identifier is provided
  if (!isbn && !upc && !barcode) {
    return {
      error: "At least one identifier (ISBN, UPC, or Barcode) is required",
    };
  }

  // Helper function to clean volume field
  const cleanVolume = (volume) => {
    if (!volume) return "";
    return volume.replace(/[\[\]\-.;]/g, "").trim();
  };

  try {
    // Get token
    const tokenResponse = await fetch(
      "https://catalog.toledolibrary.org/iii/sierra-api/v6/token",
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic N1IyTGJPOUpGREI0ZGlJcFNiMEdWakJ4NDVjdDpMU1FCQTVQd0FnUDd0d3hUUmZra2tKRmJNbUpuOTQ=",
          Accept: "application/json",
        },
      }
    );

    if (!tokenResponse.ok) {
      throw new Error("Failed to get access token");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    let bibId;
    let identifierType;
    let itemDetails = null;

    // Handle barcode differently using the 3-step process
    if (barcode) {
      identifierType = "BARCODE";

      // Step 1: Query for item by barcode
      const barcodeQueryResponse = await fetch(
        "https://catalog.toledolibrary.org/iii/sierra-api/v6/items/query?offset=0&limit=1",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            target: {
              record: { type: "item" },
              field: { tag: "b" },
            },
            expr: {
              op: "equals",
              operands: [barcode],
            },
          }),
        }
      );

      if (!barcodeQueryResponse.ok) {
        throw new Error(`Failed to query item by barcode: ${barcode}`);
      }

      const barcodeQueryData = await barcodeQueryResponse.json();

      if (!barcodeQueryData.entries || barcodeQueryData.entries.length === 0) {
        return { error: `Item not found with barcode ${barcode}` };
      }

      // Step 2: Extract item ID and get bibIds
      const itemLink = barcodeQueryData.entries[0].link;
      const itemId = itemLink.split("/items/")[1];

      const itemResponse = await fetch(
        `https://catalog.toledolibrary.org/iii/sierra-api/v6/items/${itemId}?fields=bibIds,callNumber,volumes,location,varFields,fixedFields`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!itemResponse.ok) {
        throw new Error(`Failed to get item details for ID: ${itemId}`);
      }

      itemDetails = await itemResponse.json();

      if (!itemDetails.bibIds || itemDetails.bibIds.length === 0) {
        return {
          error: `No bibliographic record found for barcode ${barcode}`,
        };
      }

      // Use the first bibId
      bibId = itemDetails.bibIds[0];
    } else {
      // Determine search parameter based on which identifier was provided
      let searchParam;

      if (isbn) {
        searchParam = isbn;
        identifierType = "ISBN";
      } else if (upc) {
        searchParam = upc;
        identifierType = "UPC";
      }

      const searchIndex = isbn ? "isbn" : "upc";

      // Search for book by the provided identifier
      const searchResponse = await fetch(
        `https://catalog.toledolibrary.org/iii/sierra-api/v6/bibs/search?limit=5&index=${searchIndex}&text=${searchParam}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!searchResponse.ok) {
        throw new Error(`Failed to search for book by ${identifierType}`);
      }

      const searchData = await searchResponse.json();
      if (!searchData.entries || searchData.entries.length === 0) {
        return {
          error: `Book not found with ${identifierType} ${searchParam}`,
        };
      }

      bibId = searchData.entries[0].bib.id;
      const itemsResponse = await fetch(
        `https://catalog.toledolibrary.org/iii/sierra-api/v6/items?bibIds=${bibId}&limit=1&fields=bibIds,callNumber,volumes,location,varFields,fixedFields`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (!itemsResponse.ok) {
        throw new Error(
          `Failed to get item details for ${identifierType}: ${searchParam}`
        );
      }

      const itemsData = await itemsResponse.json();
      if (itemsData.entries && itemsData.entries.length > 0) {
        itemDetails = itemsData.entries[0];
      } else {
        return {
          error: `No item records found for ${identifierType} ${searchParam}`,
        };
      }
    }

    // Step 3: Get bib record data
    const bibResponse = await fetch(
      `https://catalog.toledolibrary.org/iii/sierra-api/v6/bibs/${bibId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!bibResponse.ok) {
      throw new Error(`Failed to get bibliographic data for ID: ${bibId}`);
    }

    const bibData = await bibResponse.json();

    // Get additional MARC data for call number and other details
    const marcResponse = await fetch(
      `https://catalog.toledolibrary.org/iii/sierra-api/v6/bibs/${bibId}?fields=author,title,marc,locations,volumes,varFields,fixedFields`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!marcResponse.ok) {
      throw new Error("Failed to get MARC data");
    }

    const marcData = await marcResponse.json();

    // Extract call number and prefix from MARC field 092 or 099
    let callNumber = "";
    let prefix = "";

    if (marcData.marc && marcData.marc.fields) {
      // First try 092 field
      const callNumberField092 = marcData.marc.fields.find(
        (field) => field["092"]
      );

      if (callNumberField092 && callNumberField092["092"].subfields) {
        const subfields = callNumberField092["092"].subfields;

        // Look for prefix in subfield e
        const prefixSubfield = subfields.find((subfield) => subfield.e);
        if (prefixSubfield) {
          prefix = prefixSubfield.e;
        }

        // Extract call number from subfield a and remove commas
        const callNumberSubfield = subfields.find((subfield) => subfield.a);
        if (callNumberSubfield) {
          callNumber = callNumberSubfield.a.trim().replace(/,/g, "");
        }
      } else {
        // If 092 not found, try 099 field
        const callNumberField099 = marcData.marc.fields.find(
          (field) => field["099"]
        );

        if (callNumberField099 && callNumberField099["099"].subfields) {
          const subfields = callNumberField099["099"].subfields;

          // Extract call number from subfield a and remove commas
          callNumber = subfields
            .map((subfield) => subfield.a)
            .filter(Boolean)
            .join(" ")
            .replace(/,/g, "");
        }
      }
    }

    // If no call number found in MARC data, use the one from bibData if available
    if (!callNumber && bibData.callNumber) {
      callNumber = bibData.callNumber;
    }

    // Extract volume
    let volume = "";

    if (
      marcData.volumes &&
      Array.isArray(marcData.volumes) &&
      marcData.volumes.length > 0
    ) {
      // Use volumes array if available
      volume = cleanVolume(marcData.volumes[0].volume);
    } else if (marcData.marc && marcData.marc.fields) {
      // Try 260 or 264 field for date
      const publicationField = marcData.marc.fields.find(
        (field) => field["260"] || field["264"]
      );

      if (publicationField) {
        const subfields =
          publicationField["260"]?.subfields ||
          publicationField["264"]?.subfields;

        if (subfields) {
          const dateSubfield = subfields.find((subfield) => subfield.c);
          volume = dateSubfield ? cleanVolume(dateSubfield.c) : "";
        }
      }

      // Fallback to edition field 250
      if (!volume) {
        const editionField = marcData.marc.fields.find((field) => field["250"]);
        if (editionField && editionField["250"].subfields) {
          const editionSubfield = editionField["250"].subfields.find(
            (subfield) => subfield.a
          );
          volume = editionSubfield ? cleanVolume(editionSubfield.a) : "";
        }
      }
    }

    // Format location codes
    let locationCodes =
      marcData.locations && Array.isArray(marcData.locations)
        ? marcData.locations.map((loc) => loc.code).join(";")
        : "";

    // Prioritize item-level data if a barcode was used for the search
    if (itemDetails) {
      // If there's a call number in the item record, use it
      if (itemDetails.callNumber) {
        // Remove any |a, |b, etc. from the call number
        callNumber = itemDetails.callNumber.replace(/\|[a-z]/g, " ").trim();
      }

      // If there are volumes in the item record, use the first one
      if (
        itemDetails.volumes &&
        Array.isArray(itemDetails.volumes) &&
        itemDetails.volumes.length > 0
      ) {
        volume = cleanVolume(itemDetails.volumes[0].volume);
      } else if (itemDetails.varFields) {
        const volumeVarField = itemDetails.varFields.find(
          (field) => field.fieldTag === "v"
        );
        if (volumeVarField && volumeVarField.content) {
          volume = cleanVolume(volumeVarField.content);
        }
      }

      // Use the location code from the item record
      if (itemDetails.location && itemDetails.location.code) {
        locationCodes = itemDetails.location.code;
      }

      // Extract prefix from item's variable fields if available
      if (itemDetails.varFields) {
        const callNumberVarField = itemDetails.varFields.find(
          (field) => field.fieldTag === "c"
        );
        if (
          callNumberVarField &&
          callNumberVarField.subfields &&
          Array.isArray(callNumberVarField.subfields)
        ) {
          const prefixSubfield = callNumberVarField.subfields.find(
            (subfield) => subfield.tag === "e"
          );
          if (prefixSubfield && prefixSubfield.content) {
            prefix = prefixSubfield.content;
          }
        }
      }
    }

    // Return the data with the identifier that was used
    const result = {
      title: bibData.title || marcData.title,
      author: bibData.author || marcData.author,
      callNumber,
      prefix,
      volume,
      locations: marcData.locations || [],
      locationCodes,
    };

    // Add the identifier that was used to the result
    if (isbn) result.isbn = isbn;
    if (upc) result.upc = upc;
    if (barcode) result.barcode = barcode;

    return result;
  } catch (error) {
    console.error("Error in handler:", error);
    return { error: error.message };
  }
}

export async function POST(request) {
  console.log("Sierra API route hit");
  try {
    const body = await request.json();
    console.log("Request body:", body);
    const result = await handler(body);

    if (result.error) {
      console.error("Returning error response:", result.error);
    let status = 500;
    if (result.error.includes("not found")) {
      status = 404;
    } else if (result.error.includes("required")) {
      status = 400;
    }
    return Response.json(result, { status });
  }

  return Response.json(result);
  } catch (error) {
    console.error("Error in POST function:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
