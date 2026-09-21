import type { NotificationItem } from "./types";

/**
 * Placeholder feed for the header bell. Replace with an API-backed slice once
 * a notifications endpoint exists - the dropdown only needs this shape.
 */
export const mockNotifications: NotificationItem[] = [
  {
    id: 1,
    kind: "lead",
    title: "New lead assigned",
    description: "Priya Raman (MBA, Canada) was routed to your pipeline.",
    time: "2 min ago",
    read: false,
  },
  {
    id: 2,
    kind: "task",
    title: "Follow-up due today",
    description: "Call Arjun Mehta about the Germany intake documents.",
    time: "40 min ago",
    read: false,
  },
  {
    id: 3,
    kind: "user",
    title: "Staff account activated",
    description: "Neha Kapoor now has the Counsellor role.",
    time: "3 hours ago",
    read: false,
  },
  {
    id: 4,
    kind: "system",
    title: "Weekly report ready",
    description: "Admissions summary for this week is available to export.",
    time: "Yesterday",
    read: true,
  },
  {
    id: 5,
    kind: "lead",
    title: "Application submitted",
    description: "Rohan Das completed the University of Leeds application.",
    time: "Yesterday",
    read: true,
  },
  {
    id: 6,
    kind: "system",
    title: "Permissions updated",
    description: "The Counsellor role gained access to Follow-ups.",
    time: "2 days ago",
    read: true,
  },
];

export default mockNotifications;
