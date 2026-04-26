# EMFS Book Shelf – Product Requirements Document (PRD)

## Objective

### What We Want to Do

Build a **mobile-first web platform** that supports structured reading groups by enabling:

- Daily reading tracking
- Weekly reflection submission
- Attendance tracking
- Member engagement and visibility

### Why We Want to Do It

Current system (Telegram-based) has limitations:

- No clear progress tracking
- Reflections get lost in chat
- Attendance tracking is manual
- Low visibility reduces motivation

### Who Needs It

- Reading group members
- Group admins

---

## Vision

Create a system where reading becomes **consistent, structured, and visible**, helping members grow and stay accountable.

---

## Goals (First 30–60 Days)

- 80% of members submit weekly reflections
- 60% of members maintain consistent reading activity
- Reduce admin attendance tracking effort by 70%

---

## Initiatives

- Structured reading workflow
- Weekly accountability system
- Admin visibility tools

---

## Personas

### Member

- Reads daily based on assigned pages
- Writes reflections
- Needs motivation and structure

### Admin

- Manages group
- Tracks attendance
- Ensures discipline

---

## Group Structure

- Members are divided into groups based on daily reading pages:
  - 5 pages group
  - 10 pages group
  - 20 pages group
  - 40 pages group

- Each group has:
  - Assigned admin
  - Its own reading schedule

- Additional sections:
  - **General Group** → for all members to communicate
  - **Library Section** → to store completed/read books

---

## Features

### FR-1: Daily Reading Tracking

**Description**  
Members track daily reading progress based on their assigned group pages.

**User Goal**  
Track daily reading completion.

**Pain Point**  
No clear way to track daily progress.

**Solution**  
Provide a simple daily progress tracking system.

**Acceptance Criteria**

- User can mark daily reading as completed
- System shows daily status (Done / Not Done)
- Progress updates instantly
- Page loads in under 2 seconds

---

### FR-2: Weekly Reflection Submission

**Description**  
Members submit one reflection per week for attendance.

**User Goal**  
Submit reflection to confirm participation.

**Pain Point**  
Reflections are scattered and not structured.

**Solution**  
Centralized weekly reflection submission.

**Acceptance Criteria**

- User can submit one reflection per week
- Reflection is stored and viewable later
- Submission includes timestamp
- Only one submission counted for attendance per week

---

### FR-3: Attendance Tracking (Admin)

**Description**  
Admins track member attendance based on weekly reflections.

**User Goal (Admin)**  
Quickly identify active and inactive members.

**Pain Point**  
Manual tracking is inefficient.

**Solution**  
Automated attendance based on reflection submission.

**Acceptance Criteria**

- Admin can view all members
- Each member marked:
  - Submitted
  - Not Submitted
- Weekly attendance summary available
- Loads in under 2 seconds

---

### FR-4: User Registration & Group Joining

**Description**  
Users register for a session and request to join a group.

**User Goal**  
Join a reading group.

**Pain Point**  
Unstructured group entry.

**Solution**  
Controlled onboarding system.

**Acceptance Criteria**

- User registers for a session
- Group joining is closed/open based on session
- Admin approves users
- Admin sends group access link after approval

---

### FR-5: Reading Portfolio (Basic)

**Description**  
Users can see their completed books and reflections.

**User Goal**  
Track personal growth.

**Pain Point**  
No long-term record.

**Solution**  
Simple personal reading history.

**Acceptance Criteria**

- User can view completed books
- Reflections linked to books
- Data persists over time

---

## Release Plan

### Release Name

**MVP V1 – Consistency System**

### Timeline

Estimated duration: 2–4 weeks  
Start date: To be confirmed

### Features Included

- FR-1: Daily Reading Tracking
- FR-2: Weekly Reflection
- FR-3: Attendance Tracking
- FR-4: Registration & Group Joining

### Milestones

1. UI Design
2. Backend Setup
3. Core Feature Development
4. Testing & Deployment

---

## Dependencies

- Authentication system
- Database
- Hosting environment

---

## User Flow

1. User registers for session
2. Admin approves user
3. User joins group
4. User reads daily pages
5. User marks daily progress
6. User submits weekly reflection
7. Admin tracks attendance

---

## Analytics

### Hypothesis

Weekly structured reflection and visible tracking will increase reading consistency.

### Success Metrics

- Weekly reflection submission rate
- Daily activity rate
- Attendance completion rate

---

## Future Work

- Streak system
- Leaderboard
- Reflection reactions (likes/votes)
- Notifications/reminders
- Mobile app version
