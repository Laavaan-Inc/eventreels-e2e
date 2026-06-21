import { Page, expect } from "@playwright/test";
import { TIMEOUTS } from "../config/test-data";

export interface PassDef {
  name: string;
  price: number;
  passCategory: "membership" | "punchcard" | "drop_in";
  crossLocation: boolean;
  paymentType: "free" | "direct" | "paid" | "both";
  sessionCount?: number;
  description?: string;
}

export interface LocationDef {
  locationName: string;
  formattedAddress: string;
  lat: number;
  lon: number;
  schedule: {
    frequency: "weekly" | "biweekly" | "monthly";
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    startDate: string;
    sessionCount: number;
  };
  capacity: number;
}

export interface RosterEntry {
  enrollment: { _id: string; passType: string; sessionsRemaining?: number };
  user: { _id: string; name: string; email: string };
  checkedIn: boolean;
}

export class ProgramPage {
  constructor(private page: Page) {}

  async navigateToPublic(username: string, slug: string) {
    await this.page.goto(`/${username}/programs/${slug}`);
    await this.page.waitForLoadState("networkidle");
  }

  async expectPublicPageLoads(programName: string) {
    await expect(
      this.page.getByText(programName).first()
    ).toBeVisible({ timeout: TIMEOUTS.navigation });
  }

  async createViaApi(opts: {
    name: string;
    description?: string;
    passes: PassDef[];
    organizationId?: string;
  }): Promise<string> {
    const slug = opts.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const programId: string = await this.page.evaluate(
      async ({ opts, slug }) => {
        const token = localStorage.getItem("token");
        const res = await fetch("http://localhost:3001/api/v1/programs", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: token! },
          body: JSON.stringify({ ...opts, slug, status: "published" }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`createProgram ${res.status}: ${text}`);
        }
        const data = await res.json();
        return data._id as string;
      },
      { opts, slug }
    );

    return programId;
  }

  async deleteViaApi(programId: string) {
    await this.page.evaluate(async (programId) => {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:3001/api/v1/programs/${programId}`, {
        method: "DELETE",
        headers: { Authorization: token! },
      });
      if (!res.ok && res.status !== 404) {
        throw new Error(`deleteProgram ${res.status}`);
      }
    }, programId);
  }

  async addLocationViaApi(programId: string, loc: LocationDef): Promise<string> {
    const locationId: string = await this.page.evaluate(
      async ({ programId, loc }) => {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `http://localhost:3001/api/v1/programs/${programId}/locations`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: token! },
            body: JSON.stringify(loc),
          }
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`addLocation ${res.status}: ${text}`);
        }
        const data = await res.json();
        return data._id as string;
      },
      { programId, loc }
    );
    return locationId;
  }

  async getSessionsViaApi(
    programId: string,
    locationId: string
  ): Promise<Array<{ _id: string; sessionNumber: number; date: string; startTime: string }>> {
    const sessions = await this.page.evaluate(
      async ({ programId, locationId }) => {
        const res = await fetch(
          `http://localhost:3001/api/v1/programs/${programId}/locations/${locationId}/sessions`
        );
        return res.ok ? res.json() : [];
      },
      { programId, locationId }
    );
    return sessions;
  }

  async getEnrollmentsViaApi(programId: string): Promise<any[]> {
    const data = await this.page.evaluate(async (programId) => {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `http://localhost:3001/api/v1/programs/${programId}/enrollments`,
        { headers: { Authorization: token! } }
      );
      return res.ok ? res.json() : [];
    }, programId);
    return Array.isArray(data) ? data : (data as any)?.enrollments ?? [];
  }

  async approveEnrollmentViaApi(programId: string, enrollmentId: string) {
    await this.page.evaluate(
      async ({ programId, enrollmentId }) => {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `http://localhost:3001/api/v1/programs/${programId}/enrollments/${enrollmentId}/approve`,
          { method: "POST", headers: { Authorization: token! } }
        );
        if (!res.ok) throw new Error(`approveEnrollment ${res.status}`);
      },
      { programId, enrollmentId }
    );
  }

  async refundEnrollmentViaApi(programId: string, enrollmentId: string) {
    await this.page.evaluate(
      async ({ programId, enrollmentId }) => {
        const token = localStorage.getItem("token");
        await fetch(
          `http://localhost:3001/api/v1/programs/${programId}/enrollments/${enrollmentId}/refund`,
          { method: "POST", headers: { Authorization: token! } }
        );
      },
      { programId, enrollmentId }
    );
  }

  async getRosterViaApi(
    programId: string,
    sessionId: string
  ): Promise<RosterEntry[]> {
    const roster = await this.page.evaluate(
      async ({ programId, sessionId }) => {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `http://localhost:3001/api/v1/programs/${programId}/sessions/${sessionId}/roster`,
          { headers: { Authorization: token! } }
        );
        return res.ok ? res.json() : [];
      },
      { programId, sessionId }
    );
    return Array.isArray(roster) ? roster : [];
  }

  async markAttendanceViaApi(
    programId: string,
    sessionId: string,
    enrollmentId: string,
    present: boolean
  ) {
    await this.page.evaluate(
      async ({ programId, sessionId, enrollmentId, present }) => {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `http://localhost:3001/api/v1/programs/${programId}/sessions/${sessionId}/attendance`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: token! },
            body: JSON.stringify({ enrollmentId, present }),
          }
        );
        if (!res.ok) throw new Error(`markAttendance ${res.status}`);
      },
      { programId, sessionId, enrollmentId, present }
    );
  }

  async getRevenueViaApi(
    programId: string
  ): Promise<{ total: number; enrollmentCount: number; byLocation: any[] } | null> {
    const data = await this.page.evaluate(async (programId) => {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `http://localhost:3001/api/v1/programs/${programId}/revenue`,
        { headers: { Authorization: token! } }
      );
      return res.ok ? res.json() : null;
    }, programId);
    return data;
  }

  async postLocationUpdateViaApi(
    programId: string,
    locationId: string,
    message: string
  ): Promise<string> {
    const updateId: string = await this.page.evaluate(
      async ({ programId, locationId, message }) => {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `http://localhost:3001/api/v1/programs/${programId}/locations/${locationId}/updates`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: token! },
            body: JSON.stringify({ message }),
          }
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`postLocationUpdate ${res.status}: ${text}`);
        }
        const data = await res.json();
        return (data._id ?? data.update?._id ?? "") as string;
      },
      { programId, locationId, message }
    );
    return updateId;
  }

  async getLocationUpdatesViaApi(programId: string, locationId: string): Promise<any[]> {
    const data = await this.page.evaluate(
      async ({ programId, locationId }) => {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `http://localhost:3001/api/v1/programs/${programId}/locations/${locationId}/updates`,
          { headers: { Authorization: token! } }
        );
        return res.ok ? res.json() : [];
      },
      { programId, locationId }
    );
    return Array.isArray(data) ? data : [];
  }
}
