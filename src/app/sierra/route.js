export async function POST(request) {
  try {
    const body = await request.json();
    const { pType } = body;

    if (pType === undefined || pType === null || pType === '') {
      return Response.json({ error: "Patron Type (pType) is required" }, { status: 400 });
    }

    // Authenticate with Sierra API
    const tokenResponse = await fetch(
      "https://catalog.toledolibrary.org/iii/sierra-api/v6/token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${process.env.SIERRA_API_KEY}`,
          Accept: "application/json",
        },
      }
    );

    if (!tokenResponse.ok) {
      throw new Error("Failed to get access token");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    let allPatrons = [];
    let offset = 0;
    const limit = 500;
    let keepFetching = true;
    let allPatronIds = [];

    // Fetch all patron IDs matching pType using pagination
    while (keepFetching) {
      const queryResponse = await fetch(
        `https://catalog.toledolibrary.org/iii/sierra-api/v6/patrons/query?offset=${offset}&limit=${limit}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            target: {
              record: { type: "patron" },
              id: 47 // Patron Type (p-type) fixed field
            },
            expr: {
              op: "equals",
              operands: [String(pType)]
            }
          })
        }
      );

      if (!queryResponse.ok) {
        const errText = await queryResponse.text();
        console.error("Query Error", queryResponse.status, errText);
        throw new Error("Failed to query patrons");
      }

      const queryData = await queryResponse.json();
      if (!queryData.entries || queryData.entries.length === 0) {
        keepFetching = false;
      } else {
        const batchIds = queryData.entries.map(entry => entry.link.split('/patrons/')[1]);
        allPatronIds = allPatronIds.concat(batchIds);

        if (queryData.entries.length < limit) {
          keepFetching = false;
        } else {
          offset += limit;
        }
      }
    }

    console.log(`Found ${allPatronIds.length} patrons with pType ${pType}`);

    // Since fetching potentially thousands of patrons details could take a very long time
    // and cause a serverless timeout (like Vercel 10s limit), we'll limit the number
    // of returned details to something reasonable for a single request, or the frontend
    // should implement polling/batching.
    // For this implementation we will return up to 500 records at a time if the user asks,
    // but the requirements say "get a list of all cardholders with that p-type".
    // We'll attempt to fetch them all but log progress. Vercel max limit is 60s for pro, 10s hobby.
    // Let's try to fetch in larger batches.

    const batchSize = 50;

    // Safety limit to prevent timeouts in development, limit to first 1000 for now or fetch all.
    // Since this might timeout in a standard vercel route if over 10s, we will do our best.
    const idsToFetch = allPatronIds; // We'll try to fetch all

    for (let i = 0; i < idsToFetch.length; i += batchSize) {
      const batchIds = idsToFetch.slice(i, i + batchSize);
      const idString = batchIds.join(',');

      const detailsResponse = await fetch(
        `https://catalog.toledolibrary.org/iii/sierra-api/v6/patrons?id=${idString}&fields=names,barcodes,expirationDate,emails,phones,patronType&limit=${batchSize}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          }
        }
      );

      if (!detailsResponse.ok) {
        console.error("Details fetch error", detailsResponse.status, await detailsResponse.text());
        continue; // skip failed batch or handle differently
      }

      const detailsData = await detailsResponse.json();
      if (detailsData.entries) {
          allPatrons.push(...detailsData.entries);
      }
    }

    return Response.json(allPatrons);

  } catch (error) {
    console.error("Error in POST function:", error);
    return Response.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
