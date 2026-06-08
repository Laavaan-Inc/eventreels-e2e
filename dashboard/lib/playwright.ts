import { execSync } from "child_process";
import path from "path";

const E2E_ROOT = path.resolve(__dirname, "../../");

export function listTests(): [string, string][] {
  try {
    const out = execSync("npx playwright test --list --reporter=line 2>/dev/null || true", {
      cwd: E2E_ROOT,
      encoding: "utf-8",
      timeout: 30_000,
    });

    const lines = out.split("\n");
    const tests: [string, string][] = [];

    for (const line of lines) {
      // Playwright --list outputs lines like:  specs/auth.spec.ts:10:3 › Auth > Login valid OTP
      const m = line.match(/^\s*(specs\/[^\s]+\.spec\.ts)[^›]*›\s*(.+)$/);
      if (m) {
        tests.push([m[1].trim(), m[2].trim()]);
      }
    }

    return tests.length ? tests : fallbackList();
  } catch {
    return fallbackList();
  }
}

function fallbackList(): [string, string][] {
  return [
    // Auth
    ["specs/auth.spec.ts", "Login — valid OTP > valid bypass OTP redirects away from /auth"],
    ["specs/auth.spec.ts", "Login — invalid OTP > wrong OTP shows error message"],
    ["specs/auth.spec.ts", "OTP screen > resend timer is shown after sending code"],
    ["specs/auth.spec.ts", "Session persistence > authenticated user stays logged in after page reload"],
    ["specs/auth.spec.ts", "Session persistence > authenticated user can access /manage without redirect"],
    ["specs/auth.spec.ts", "Session persistence > unauthenticated browser is redirected to /auth on protected page"],
    // Create Event
    ["specs/event-types.spec.ts", "Create Event — ticket mode > Free event sends ticketMode=free"],
    ["specs/event-types.spec.ts", "Create Event — ticket mode > Chip-in event sends ticketMode=chip"],
    ["specs/event-types.spec.ts", "Create Event — ticket mode > Paid event sends ticketMode=paid with price"],
    ["specs/event-types.spec.ts", "Create Event — date undecided > dateUndecided flag is true in request body"],
    ["specs/event-types.spec.ts", "Create Event — settings > approval toggle sets requireApproval=true"],
    ["specs/event-types.spec.ts", "Create Event — settings > link-only sets isPrivate=true, approvalRequired=false"],
    ["specs/event-types.spec.ts", "Create Event — settings > invite-only sets isPrivate=true, approvalRequired=true"],
    ["specs/event-types.spec.ts", "Create Event — settings > capacity limit is included in body"],
    ["specs/event-types.spec.ts", "Create Event — settings > event password is included in body"],
    ["specs/event-types.spec.ts", "Create Event — questionnaire > question is included in the request body"],
    ["specs/event-types.spec.ts", "Create Event — location > virtual link is set"],
    ["specs/event-types.spec.ts", "Create Event — location > physical address is set"],
    // RSVP Journeys
    ["specs/rsvp.spec.ts", "Free event RSVP journey > guest who RSVPed shows in organizer's guest list"],
    ["specs/rsvp.spec.ts", "Free event RSVP journey > guest count on overview stat updates after RSVP"],
    ["specs/rsvp.spec.ts", "Free event RSVP journey > organizer sees event page with RSVP'd guest count"],
    ["specs/rsvp.spec.ts", "Approval event RSVP journey > pending join request appears in organizer Join Requests tab"],
    ["specs/rsvp.spec.ts", "Approval event RSVP journey > new join request appears after guest requests to join"],
    ["specs/rsvp.spec.ts", "Approval event RSVP journey > approving a join request shows success feedback"],
    ["specs/rsvp.spec.ts", "Approval event RSVP journey > after approval, guest appears in confirmed Guests tab"],
    ["specs/rsvp.spec.ts", "Approval event RSVP journey > invite-only event shows Approve Guests button on event page"],
    ["specs/rsvp.spec.ts", "Date-TBD RSVP journey > seeded Interested RSVP shows in Join Requests as 'Interested' label"],
    ["specs/rsvp.spec.ts", "Date-TBD RSVP journey > seeded Maybe RSVP shows in Join Requests as 'Maybe' label"],
    ["specs/rsvp.spec.ts", "Date-TBD RSVP journey > seeded Not-going RSVP shows in Join Requests as 'Not going' label"],
    ["specs/rsvp.spec.ts", "Date-TBD RSVP journey > new Interested RSVP via API appears in Join Requests immediately"],
    ["specs/rsvp.spec.ts", "Date-TBD RSVP journey > all three RSVP labels are visible simultaneously"],
    ["specs/rsvp.spec.ts", "Date-TBD RSVP journey > Date-TBD Join Requests tab shows no approve/reject buttons"],
    // Date TBD
    ["specs/date-undecided.spec.ts", "dateUndecided — event page buttons > shows 'Confirm Date' button (not 'Approve Guests')"],
    ["specs/date-undecided.spec.ts", "dateUndecided — event page buttons > 'Confirm Date' button opens a date-picker dialog"],
    ["specs/date-undecided.spec.ts", "dateUndecided — event page buttons > date picker shows a calendar or date input"],
    ["specs/date-undecided.spec.ts", "dateUndecided — event page buttons > fixed-date event shows 'Approve Guests' button"],
    ["specs/date-undecided.spec.ts", "dateUndecided — event page buttons > fixed-date event does NOT show 'Confirm Date' button"],
    ["specs/date-undecided.spec.ts", "dateUndecided — manage overview > clicking the Interested/response count navigates to Join Requests sub-tab"],
    ["specs/date-undecided.spec.ts", "dateUndecided — manage overview > overview stat shows response count > 0 for seeded TBD event"],
    ["specs/date-undecided.spec.ts", "dateUndecided — Join Requests labels > shows 'Interested' label pill for seeded user"],
    ["specs/date-undecided.spec.ts", "dateUndecided — Join Requests labels > shows 'Maybe' label pill for seeded user"],
    ["specs/date-undecided.spec.ts", "dateUndecided — Join Requests labels > shows 'Not going' label pill for seeded user"],
    ["specs/date-undecided.spec.ts", "dateUndecided — Join Requests labels > all three label types visible simultaneously"],
    ["specs/date-undecided.spec.ts", "dateUndecided — no approval actions > no Approve/Reject buttons shown on TBD Join Requests tab"],
    ["specs/date-undecided.spec.ts", "dateUndecided — no approval actions > approval event DOES show Approve/Reject on its Join Requests tab"],
    // Manage Guests
    ["specs/manage-guests.spec.ts", "Manage — overview stats > overview shows event name for fixed event"],
    ["specs/manage-guests.spec.ts", "Manage — overview stats > overview shows a guest/attendee stat"],
    ["specs/manage-guests.spec.ts", "Manage — overview stats > overview shows join-request stat for approval event"],
    ["specs/manage-guests.spec.ts", "Manage — overview stats > clicking interested count navigates to Join Requests sub-tab (TBD event)"],
    ["specs/manage-guests.spec.ts", "Manage — guests tab > Guests sub-tab loads and shows guest list for free event"],
    ["specs/manage-guests.spec.ts", "Manage — guests tab > guest list shows at least one seeded guest"],
    ["specs/manage-guests.spec.ts", "Manage — guests tab > invite button is accessible on the guests tab"],
    ["specs/manage-guests.spec.ts", "Manage — join requests (approval event) > Join Requests tab loads for approval event"],
    ["specs/manage-guests.spec.ts", "Manage — join requests (approval event) > new join request appears after guest registers via API"],
    ["specs/manage-guests.spec.ts", "Manage — join requests (approval event) > approve button is present on a pending request"],
    ["specs/manage-guests.spec.ts", "Manage — join requests (approval event) > reject button is present on a pending request"],
    ["specs/manage-guests.spec.ts", "Manage — invite flow > invite dialog opens with an email input field"],
    // Profile
    ["specs/profile.spec.ts", "Profile tabs > Date TBD tab is visible"],
    ["specs/profile.spec.ts", "Profile tabs > Upcoming tab shows fixed-date event"],
    ["specs/profile.spec.ts", "Profile tabs > Upcoming tab does NOT show dateUndecided event"],
    ["specs/profile.spec.ts", "Profile tabs > Date TBD tab shows dateUndecided hosted event"],
    ["specs/profile.spec.ts", "Profile tabs > Date TBD tab shows Hosting badge"],
    ["specs/profile.spec.ts", "Profile tabs > Hosting tab does NOT show dateUndecided event"],
    ["specs/profile.spec.ts", "Profile tabs > Past tab does NOT show dateUndecided event"],
    // Check-in
    ["specs/check-in.spec.ts", "Check-in — page access > check-in page loads for organizer's seeded event"],
    ["specs/check-in.spec.ts", "Check-in — page access > check-in page shows event name or guest roster"],
    ["specs/check-in.spec.ts", "Check-in — manual ticket code entry > invalid ticket code shows an error message"],
    ["specs/check-in.spec.ts", "Check-in — manual ticket code entry > empty ticket code submission shows validation feedback"],
    ["specs/check-in.spec.ts", "Check-in — manual ticket code entry > malformed ticket code (special chars) is handled gracefully"],
    ["specs/check-in.spec.ts", "Check-in — guest roster > guests who RSVPed 'going' appear on check-in guest list"],
  ];
}
