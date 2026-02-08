SOP IMAGE GENERATION CODE - COMPLETE REFERENCE
================================================

This folder contains all the code involved when you click
"Generate" to create an AI image for an SOP step.

FILES:
------

1_FRONTEND_SOPBuilder_generate-image.tsx
  - The React frontend code that fires when you click Generate
  - Sends POST to /api/sop-media/ai-generate
  - Then polls /api/sop-media/ai-generate/status/:jobId every 3 seconds

2_BACKEND_routes_ai-generate-endpoint.ts
  - The Express server route that handles the POST request
  - Calls OpenAI gpt-image-1 API to generate the image
  - Uploads the image to Replit Object Storage via signed URL
  - Saves the record to the sop_media database table
  - Marks the job as "completed" so the frontend poll picks it up

3_BACKEND_image-serving-route.ts
  - The Express route that serves images when the browser loads
    a URL like /objects/sop-media/xxx.png
  - Fetches the file from object storage and streams it to the browser

4_PRODUCTION_DATABASE_latest-results.txt
  - Raw query results from the production database showing
    the most recent generated images
  - Includes a curl verification proving the image serves correctly
    (HTTP 200, image/png, ~2MB)

FLOW SUMMARY:
-------------
1. User clicks Generate → frontend POSTs to /api/sop-media/ai-generate
2. Server returns { jobId, status: "processing" } immediately
3. Server runs background task: OpenAI API → get image → upload to storage → save to DB
4. Frontend polls /api/sop-media/ai-generate/status/:jobId every 3 sec
5. When job completes, frontend gets { status: "completed", result: { id, url, ... } }
6. Frontend sets preview with url like /objects/sop-media/xxx.png
7. Browser requests that URL → image serving route fetches from object storage → returns PNG
