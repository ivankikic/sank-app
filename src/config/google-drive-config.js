export const GOOGLE_DRIVE_CONFIG = {
  clientId: import.meta.env.VITE_CLIENT_ID,
  apiKey: import.meta.env.VITE_API_KEY,
  scope: "https://www.googleapis.com/auth/drive.file",
  discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
};
