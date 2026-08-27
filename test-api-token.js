async function test() {
  const tokenResponse = await fetch(
    "https://catalog.toledolibrary.org/iii/sierra-api/v6/token",
    {
      method: "POST",
      headers: {
        Authorization: "Basic UTZYVmI0THdRSXdGOGppZ1JUUC9hbUlGYnBTTTpvcGl1ZXdxcmtsamhzYWR2bGtqc2Rmb2l1ZXdybjkzMjcrMjEz=",
      },
    }
  );
  console.log("No body:", tokenResponse.status, await tokenResponse.text());

  const tokenResponse2 = await fetch(
    "https://catalog.toledolibrary.org/iii/sierra-api/v6/token",
    {
      method: "POST",
      headers: {
        Authorization: "Basic UTZYVmI0THdRSXdGOGppZ1JUUC9hbUlGYnBTTTpvcGl1ZXdxcmtsamhzYWR2bGtqc2Rmb2l1ZXdybjkzMjcrMjEz=",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials"
    }
  );
  console.log("With body:", tokenResponse2.status, await tokenResponse2.text());
}
test();
