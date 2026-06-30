# SYSTEM_SPEC.md

@system
Quadro do Mané

@type
SaaS Task Management Platform

@goal
Generate a full-stack task and project management system similar to Asana, ClickUp and Monday.

The system must support:

- multi-tenant SaaS architecture
- teams
- projects
- tasks
- kanban board
- comments
- checklists
- attachments
- notifications
- calendar
- contacts
- dashboards

Backend must expose a REST API.

Frontend must be responsive.

System must be ready for mobile apps.

---

# TECHNOLOGY STACK

Backend

- NestJS
- Prisma ORM
- PostgreSQL
- JWT Authentication

Frontend

- NextJS
- React
- TailwindCSS
- shadcn/ui
- React Query
- Zustand

Infrastructure

- Docker
- Linux VPS
- S3 compatible storage

---

# PROJECT STRUCTURE

Monorepo.


/apps
/api
/web

/packages
/database
/ui
/utils


---

# SAAS ARCHITECTURE

The system is multi-tenant.

Each company is a **tenant**.

All operational tables include:


tenant_id


All queries must include tenant isolation:


WHERE tenant_id = currentTenant


Users can belong to multiple tenants.

---

# DOMAIN MODEL

Entities:

Tenant  
User  
TenantUser  
Role  
Permission  
Team  
Project  
Task  
TaskStatus  
TaskPriority  
TaskComment  
TaskChecklist  
TaskChecklistItem  
TaskTag  
Event  
Contact  
Notification  
ActivityLog  
AuditLog  

---

# ENTITY DEFINITIONS

## Tenant

Represents a company.

Fields:

- id
- name
- slug
- status
- created_at

---

## User

Platform user.

Fields:

- id
- name
- email
- password_hash
- avatar
- last_login

---

## TenantUser

Relationship between User and Tenant.

Fields:

- id
- tenant_id
- user_id
- role_id
- department
- job_title

---

## Role

Access role.

Examples:

admin  
manager  
member  
guest

---

## Permission

Examples:

projects.view  
projects.create  
tasks.create  
tasks.move  
teams.manage

---

## Team

Represents a department or team.

Fields:

- id
- tenant_id
- name
- manager_id

---

## Project

Represents a project.

Fields:

- id
- tenant_id
- name
- description
- status
- owner_id
- team_id
- start_date
- due_date
- progress_percent

---

## Task

Represents a task.

Fields:

- id
- tenant_id
- project_id
- title
- description
- status_id
- priority_id
- assignee_id
- reporter_id
- start_date
- due_date
- estimated_minutes
- spent_minutes
- kanban_position

---

## TaskStatus

Examples:

backlog  
todo  
in_progress  
review  
done

---

## TaskPriority

Examples:

low  
normal  
high  
urgent

---

## TaskComment

Fields:

- id
- tenant_id
- task_id
- author_id
- content

---

## TaskChecklist

Checklist for a task.

---

## TaskChecklistItem

Checklist item.

---

## TaskTag

Tag for categorization.

---

## Event

Calendar event.

Fields:

- id
- tenant_id
- title
- start_at
- end_at
- project_id
- task_id

---

## Contact

Company phonebook.

Fields:

- id
- tenant_id
- name
- company
- email
- phone

---

## Notification

System notification.

Fields:

- id
- tenant_id
- tenant_user_id
- type
- message
- is_read

---

## ActivityLog

Operational log.

Fields:

- id
- tenant_id
- actor_id
- entity_type
- entity_id
- action

---

## AuditLog

Security log.

Fields:

- id
- tenant_id
- actor_id
- action
- metadata

---

# DATABASE

Use PostgreSQL.

Use Prisma ORM.

Main tables:

tenants  
users  
tenant_users  
roles  
permissions  
role_permissions  
teams  
team_members  
projects  
project_members  
tasks  
task_statuses  
task_priorities  
task_comments  
task_tags  
task_checklists  
task_checklist_items  
events  
contacts  
notifications  
activity_logs  
audit_logs  

---

# AUTHENTICATION

JWT based authentication.

Endpoints:

POST /auth/login  
POST /auth/select-tenant  
POST /auth/refresh  
POST /auth/logout  
GET /auth/me  

Login flow:

1 user logs in
2 select tenant
3 generate session token

---

# ACCESS CONTROL

RBAC system.

Backend guards:

PermissionGuard  
TenantContextGuard  

Frontend helper:

can(permission)

---

# API

Teams

GET /teams  
POST /teams  
PATCH /teams/:id  
DELETE /teams/:id  

---

Projects

GET /projects  
POST /projects  
GET /projects/:id  
PATCH /projects/:id  
DELETE /projects/:id  

---

Tasks

GET /tasks  
POST /tasks  
GET /tasks/:id  
PATCH /tasks/:id  
DELETE /tasks/:id  

---

Kanban

PATCH /tasks/:id/move

---

Task Status

PATCH /tasks/:id/status

---

Task Priority

PATCH /tasks/:id/priority

---

Comments

POST /tasks/:id/comments  
DELETE /comments/:id  

---

Calendar

GET /events  
POST /events  
PATCH /events/:id  
DELETE /events/:id  

---

Contacts

GET /contacts  
POST /contacts  
PATCH /contacts/:id  
DELETE /contacts/:id  

---

Notifications

GET /notifications  
PATCH /notifications/:id/read  
PATCH /notifications/read-all  

---

# FRONTEND

Main layout:

Sidebar  
Header  
MainContent  
ContextPanel  

---

# ROUTES

/dashboard  
/projects  
/tasks  
/teams  
/calendar  
/contacts  
/settings  

---

# KANBAN

Implement drag-and-drop board.

Use library:

dnd-kit

Features:

- reorder tasks
- move between columns
- update backend with PATCH /tasks/:id/move

---

# DASHBOARD

Use charts.

Library:

Recharts

Metrics:

- productivity
- workload
- project progress

---

# FILE UPLOAD

Store files in S3 compatible storage.

Database stores metadata only.

---

# LOGGING

Activity logs stored in:

activity_logs

Security logs stored in:

audit_logs

---

# FUTURE MODULES

Automation engine

trigger  
conditions  
actions  

Example:

task overdue → notify manager

---

Billing system

plans  
subscriptions  
usage_counters  

---

# DEVELOPMENT ORDER

1 project structure  
2 database  
3 authentication  
4 access control  
5 teams module  
6 projects module  
7 tasks module  
8 kanban  
9 calendar  
10 contacts  
11 notifications  
12 dashboard  
13 file uploads  
14 logging  
15 automations  
16 billing  

---

# IMPLEMENTATION REQUIREMENTS

All database queries must enforce tenant isolation.

Use DTO validation in backend.

Use service layer architecture.

Controllers must be thin.

Frontend must use React Query for API calls.

State management must use Zustand.

Components must use Tailwind + shadcn.

---

# FINAL OBJECTIVE

Generate a production-ready SaaS task management platform with:

- multi-tenant architecture
- kanban task boards
- project management
- collaboration tools
- dashboards
- scalable API
- responsive UI