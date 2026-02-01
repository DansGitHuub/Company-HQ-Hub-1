import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy'
];

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = getRedirectUri();
  
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }
  
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function getRedirectUri() {
  const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || process.env.REPLIT_DEV_DOMAIN;
  if (!domain) {
    throw new Error('No domain configured for OAuth redirect');
  }
  return `https://${domain}/api/auth/google/callback`;
}

export function getAuthUrl(userId: string): string {
  const oauth2Client = getOAuth2Client();
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: userId
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function refreshAccessToken(refreshToken: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
}

export function getCalendarClient(accessToken: string): calendar_v3.Calendar {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export async function getUserCalendarEvents(
  accessToken: string,
  startDate: Date,
  endDate: Date,
  calendarId: string = 'primary'
) {
  const calendar = getCalendarClient(accessToken);
  
  const response = await calendar.events.list({
    calendarId,
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100
  });
  
  return response.data.items || [];
}

export async function createCalendarEvent(
  accessToken: string,
  event: {
    summary: string;
    description?: string;
    location?: string;
    start: { dateTime: string; timeZone?: string } | { date: string };
    end: { dateTime: string; timeZone?: string } | { date: string };
  },
  calendarId: string = 'primary'
) {
  const calendar = getCalendarClient(accessToken);
  
  const response = await calendar.events.insert({
    calendarId,
    requestBody: event
  });
  
  return response.data;
}

export async function checkForConflicts(
  accessToken: string,
  startTime: Date,
  endTime: Date,
  calendarId: string = 'primary'
) {
  const calendar = getCalendarClient(accessToken);
  
  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      items: [{ id: calendarId }]
    }
  });
  
  const busyTimes = response.data.calendars?.[calendarId]?.busy || [];
  return busyTimes.length > 0 ? busyTimes : null;
}

export async function getUserCalendarList(accessToken: string) {
  const calendar = getCalendarClient(accessToken);
  
  const response = await calendar.calendarList.list();
  return response.data.items || [];
}

export function isTokenExpired(tokenExpiry: Date | null): boolean {
  if (!tokenExpiry) return true;
  return new Date(tokenExpiry).getTime() <= Date.now() + 5 * 60 * 1000;
}
