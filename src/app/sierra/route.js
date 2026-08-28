export async function POST(request) {
  try {
    const body = await request.json();
    const { pType } = body;

    // Validate required Patron Type
    if (pType === undefined || pType === null || pType === "") {
      return Response.json(
        { error: "Patron Type (pType) is required" },
        { status: 400 }
      );
    }

    // Validate Sierra credentials
    const clientId = process.env.SIERRA_CLIENT_ID;
    const clientSecret = process.env.SIERRA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error(
        "Missing Sierra credentials. Check SIERRA_CLIENT_ID and SIERRA_CLIENT_SECRET environment variables."
      );

      return Response.json(
        { error: "Sierra API credentials are not configured" },
        { status: 500 }
      );
    }

    // Create Basic Auth value: Base64(client_id:client_secret)
    const credentials = Buffer.from(
      `${clientId}:${clientSecret}`
    ).toString("base64");

    // Authenticate with Sierra API
    const tokenResponse = await fetch(
      "https://catalog.toledolibrary.org/iii/sierra-api/v6/token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
        cache: "no-store",
      }
    );

    // Log the actual token error from Sierra
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();

      console.error("Sierra token request failed:", {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        body: errorText,
      });

      return Response.json(
        {
          error: "Failed to authenticate with Sierra API",
          details: `Sierra returned ${tokenResponse.status}`,
        },
        { status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error(
        "Sierra token response did not contain an access_token:",
        tokenData
      );

      return Response.json(
        { error: "Sierra API did not return an access token" },
        { status: 500 }
      );
    }

    console.log("Successfully authenticated with Sierra API");

    // Storage for results
    const allPatrons = [];
    const allPatronIds = [];

    let offset = 0;

    // Sierra may enforce a maximum limit.
    // 1000 is safer than requesting 1,000,000 records at once.
    const queryLimit = 1000;
    let keepFetching = true;

    // Fetch all patron IDs matching pType
    while (keepFetching) {
      const queryUrl = new URL(
        "https://catalog.toledolibrary.org/iii/sierra-api/v6/patrons/query"
      );

      queryUrl.searchParams.set("offset", offset);
      queryUrl.searchParams.set("limit", queryLimit);

      const queryResponse = await fetch(queryUrl.toString(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: {
            record: {
              type: "patron",
            },
            id: 47,
          },
          expr: {
            op: "equals",
            operands: [String(pType), ""],
          },
        }),
        cache: "no-store",
      });

      if (!queryResponse.ok) {
        const errorText = await queryResponse.text();

        console.error("Sierra patron query failed:", {
          status: queryResponse.status,
          statusText: queryResponse.statusText,
          body: errorText,
          offset,
          pType,
        });

        throw new Error(
          `Failed to query patrons: ${queryResponse.status} ${errorText}`
        );
      }

      const queryData = await queryResponse.json();
      const entries = queryData.entries || [];

      console.log(
        `Patron query returned ${entries.length} records at offset ${offset}`
      );

      // Stop if no more records
      if (entries.length === 0) {
        keepFetching = false;
        break;
      }

      // Extract patron IDs from entry links
      const batchIds = entries
        .map((entry) => {
          if (!entry.link) return null;

          const match = entry.link.match(/\/patrons\/([^/?]+)/);

          return match ? match[1] : null;
        })
        .filter(Boolean);

      allPatronIds.push(...batchIds);

      // If fewer records than requested were returned, this is the last page
      if (entries.length < queryLimit) {
        keepFetching = false;
      } else {
        offset += queryLimit;
      }
    }

    console.log(
      `Found ${allPatronIds.length} patrons with pType ${pType}`
    );

    // Fetch full patron details in batches
    const batchSize = 50;

    for (let i = 0; i < allPatronIds.length; i += batchSize) {
      const batchIds = allPatronIds.slice(i, i + batchSize);

      const detailsUrl = new URL(
        "https://catalog.toledolibrary.org/iii/sierra-api/v6/patrons"
      );

      detailsUrl.searchParams.set("id", batchIds.join(","));
      detailsUrl.searchParams.set(
        "fields",
        "names,barcodes,expirationDate,emails,phones,patronType"
      );
      detailsUrl.searchParams.set("limit", batchSize);

      const detailsResponse = await fetch(detailsUrl.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!detailsResponse.ok) {
        const errorText = await detailsResponse.text();

        console.error("Sierra patron details fetch failed:", {
          status: detailsResponse.status,
          statusText: detailsResponse.statusText,
          body: errorText,
          batchStart: i,
          batchIds,
        });

        // Continue with the remaining batches
        continue;
      }

      const detailsData = await detailsResponse.json();

      if (detailsData.entries && Array.isArray(detailsData.entries)) {
        allPatrons.push(...detailsData.entries);
      }

      console.log(
        `Fetched patron details ${i + 1}-${Math.min(
          i + batchSize,
          allPatronIds.length
        )} of ${allPatronIds.length}`
      );
    }

    console.log(
      `Successfully returned ${allPatrons.length} patron records`
    );

    return Response.json({
      count: allPatrons.length,
      patrons: allPatrons,
    });
  } catch (error) {
    console.error("Error in POST function:", error);

    return Response.json(
      {
        error: error.message || "Internal Server Error",
      },
      { status: 500 }
    );
  }
}