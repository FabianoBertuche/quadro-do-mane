--
-- PostgreSQL database dump
--

\restrict CGyhgaBZCU5NxGHL6asHiWoagaRVeYdEuTxscdSTWgnGAFCBsOdo4qeRIfhtZwG

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ProjectStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ProjectStatus" AS ENUM (
    'DRAFT',
    'ACTIVE',
    'ON_HOLD',
    'COMPLETED',
    'CANCELLED',
    'ARCHIVED'
);


ALTER TYPE public."ProjectStatus" OWNER TO postgres;

--
-- Name: ProjectViewType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ProjectViewType" AS ENUM (
    'LIST',
    'KANBAN',
    'CALENDAR',
    'TIMELINE',
    'DASHBOARD'
);


ALTER TYPE public."ProjectViewType" OWNER TO postgres;

--
-- Name: SubscriptionStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SubscriptionStatus" AS ENUM (
    'ACTIVE',
    'TRIAL',
    'EXPIRED',
    'CANCELLED',
    'TRIALING',
    'PAST_DUE'
);


ALTER TYPE public."SubscriptionStatus" OWNER TO postgres;

--
-- Name: TenantStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TenantStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED'
);


ALTER TYPE public."TenantStatus" OWNER TO postgres;

--
-- Name: TenantUserStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TenantUserStatus" AS ENUM (
    'ACTIVE',
    'INVITED',
    'SUSPENDED'
);


ALTER TYPE public."TenantUserStatus" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_logs (
    id text NOT NULL,
    tenant_id text NOT NULL,
    actor_tenant_user_id text,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    action text NOT NULL,
    old_values_json text,
    new_values_json text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.activity_logs OWNER TO postgres;

--
-- Name: attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attachments (
    id text NOT NULL,
    tenant_id text NOT NULL,
    task_id text,
    project_id text,
    uploaded_by_tenant_user_id text NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    mime_type text,
    file_size integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.attachments OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    tenant_id text,
    actor_user_id text,
    action text NOT NULL,
    target_type text,
    target_id text,
    ip_address text,
    user_agent text,
    metadata_json text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: automations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.automations (
    id text NOT NULL,
    tenant_id text NOT NULL,
    name text NOT NULL,
    description text,
    trigger_type text NOT NULL,
    conditions_json text,
    actions_json text,
    is_active boolean DEFAULT true NOT NULL,
    created_by_tenant_user_id text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.automations OWNER TO postgres;

--
-- Name: contacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contacts (
    id text NOT NULL,
    tenant_id text NOT NULL,
    name text NOT NULL,
    company text,
    department text,
    role text,
    email text,
    phone text,
    mobile text,
    extension text,
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.contacts OWNER TO postgres;

--
-- Name: custom_field_values; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.custom_field_values (
    id text NOT NULL,
    tenant_id text NOT NULL,
    custom_field_id text NOT NULL,
    entity_id text NOT NULL,
    value_text text,
    value_number numeric(18,4),
    value_date timestamp(3) without time zone,
    value_boolean boolean,
    value_json text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.custom_field_values OWNER TO postgres;

--
-- Name: custom_fields; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.custom_fields (
    id text NOT NULL,
    tenant_id text NOT NULL,
    entity_type text NOT NULL,
    name text NOT NULL,
    field_type text NOT NULL,
    config_json text,
    is_required boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.custom_fields OWNER TO postgres;

--
-- Name: daily_routine_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_routine_items (
    id text NOT NULL,
    tenant_id text NOT NULL,
    assigned_tenant_user_id text NOT NULL,
    created_by_id text NOT NULL,
    title text NOT NULL,
    description text,
    scheduled_time text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.daily_routine_items OWNER TO postgres;

--
-- Name: daily_routine_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_routine_logs (
    id text NOT NULL,
    tenant_id text NOT NULL,
    routine_item_id text NOT NULL,
    tenant_user_id text NOT NULL,
    date text NOT NULL,
    completed_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_completed boolean DEFAULT true NOT NULL,
    notes text
);


ALTER TABLE public.daily_routine_logs OWNER TO postgres;

--
-- Name: email_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_settings (
    id text NOT NULL,
    tenant_id text NOT NULL,
    tenant_user_id text NOT NULL,
    protocol text DEFAULT 'imap'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    password_ciphertext text NOT NULL,
    password_iv text NOT NULL,
    password_auth_tag text NOT NULL
);


ALTER TABLE public.email_settings OWNER TO postgres;

--
-- Name: email_tenant_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_tenant_settings (
    id text NOT NULL,
    tenant_id text NOT NULL,
    email_domain text NOT NULL,
    detection_mode text DEFAULT 'PRESET'::text NOT NULL,
    preset_key text,
    imap_host text NOT NULL,
    imap_port integer NOT NULL,
    imap_secure boolean DEFAULT true NOT NULL,
    smtp_host text NOT NULL,
    smtp_port integer NOT NULL,
    smtp_secure boolean DEFAULT true NOT NULL,
    updated_by_tenant_user_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.email_tenant_settings OWNER TO postgres;

--
-- Name: event_attendees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.event_attendees (
    id text NOT NULL,
    tenant_id text NOT NULL,
    event_id text NOT NULL,
    tenant_user_id text NOT NULL,
    response_status text
);


ALTER TABLE public.event_attendees OWNER TO postgres;

--
-- Name: events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.events (
    id text NOT NULL,
    tenant_id text NOT NULL,
    title text NOT NULL,
    description text,
    type text,
    start_at timestamp(3) without time zone NOT NULL,
    end_at timestamp(3) without time zone NOT NULL,
    all_day boolean DEFAULT false NOT NULL,
    created_by_tenant_user_id text NOT NULL,
    related_project_id text,
    related_task_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.events OWNER TO postgres;

--
-- Name: login_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.login_attempts (
    id text NOT NULL,
    email text NOT NULL,
    ip_address text,
    user_agent text,
    success boolean NOT NULL,
    reason text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.login_attempts OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    tenant_id text NOT NULL,
    tenant_user_id text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    payload_json text,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    module text NOT NULL
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plans (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    max_users integer,
    max_projects integer,
    max_storage_mb integer,
    monthly_price numeric(10,2) DEFAULT 0 NOT NULL,
    annual_price numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.plans OWNER TO postgres;

--
-- Name: project_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_members (
    id text NOT NULL,
    tenant_id text NOT NULL,
    project_id text NOT NULL,
    tenant_user_id text NOT NULL,
    role_in_project text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.project_members OWNER TO postgres;

--
-- Name: project_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_views (
    id text NOT NULL,
    tenant_id text NOT NULL,
    project_id text NOT NULL,
    name text NOT NULL,
    type public."ProjectViewType" NOT NULL,
    config_json text,
    created_by text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.project_views OWNER TO postgres;

--
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.projects (
    id text NOT NULL,
    tenant_id text NOT NULL,
    name text NOT NULL,
    code text,
    description text,
    status public."ProjectStatus" DEFAULT 'ACTIVE'::public."ProjectStatus" NOT NULL,
    priority text,
    owner_tenant_user_id text,
    team_id text,
    start_date timestamp(3) without time zone,
    due_date timestamp(3) without time zone,
    completed_at timestamp(3) without time zone,
    progress_percent integer DEFAULT 0 NOT NULL,
    color text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    archived_at timestamp(3) without time zone
);


ALTER TABLE public.projects OWNER TO postgres;

--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.refresh_tokens (
    id text NOT NULL,
    user_id text NOT NULL,
    tenant_id text NOT NULL,
    token_hash text NOT NULL,
    family text NOT NULL,
    is_revoked boolean DEFAULT false NOT NULL,
    replaced_by_id text,
    user_agent text,
    ip_address text,
    expires_at timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.refresh_tokens OWNER TO postgres;

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    id text NOT NULL,
    role_id text NOT NULL,
    permission_id text NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id text NOT NULL,
    tenant_id text,
    name text NOT NULL,
    description text,
    is_system_role boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscriptions (
    id text NOT NULL,
    tenant_id text NOT NULL,
    plan_id text NOT NULL,
    status public."SubscriptionStatus" DEFAULT 'ACTIVE'::public."SubscriptionStatus" NOT NULL,
    started_at timestamp(3) without time zone NOT NULL,
    expires_at timestamp(3) without time zone,
    trial_ends_at timestamp(3) without time zone,
    cancelled_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.subscriptions OWNER TO postgres;

--
-- Name: task_assignees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_assignees (
    id text NOT NULL,
    tenant_id text NOT NULL,
    task_id text NOT NULL,
    tenant_user_id text NOT NULL,
    assigned_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.task_assignees OWNER TO postgres;

--
-- Name: task_checklist_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_checklist_items (
    id text NOT NULL,
    tenant_id text NOT NULL,
    checklist_id text NOT NULL,
    content text NOT NULL,
    is_done boolean DEFAULT false NOT NULL,
    done_by_tenant_user_id text,
    done_at timestamp(3) without time zone,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.task_checklist_items OWNER TO postgres;

--
-- Name: task_checklists; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_checklists (
    id text NOT NULL,
    tenant_id text NOT NULL,
    task_id text NOT NULL,
    title text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.task_checklists OWNER TO postgres;

--
-- Name: task_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_comments (
    id text NOT NULL,
    tenant_id text NOT NULL,
    task_id text NOT NULL,
    author_tenant_user_id text NOT NULL,
    content text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


ALTER TABLE public.task_comments OWNER TO postgres;

--
-- Name: task_priorities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_priorities (
    id text NOT NULL,
    tenant_id text NOT NULL,
    name text NOT NULL,
    level integer DEFAULT 0 NOT NULL,
    color text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.task_priorities OWNER TO postgres;

--
-- Name: task_statuses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_statuses (
    id text NOT NULL,
    tenant_id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    color text,
    "position" integer DEFAULT 0 NOT NULL,
    category text DEFAULT 'pending'::text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.task_statuses OWNER TO postgres;

--
-- Name: task_tag_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_tag_links (
    id text NOT NULL,
    tenant_id text NOT NULL,
    task_id text NOT NULL,
    tag_id text NOT NULL
);


ALTER TABLE public.task_tag_links OWNER TO postgres;

--
-- Name: task_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_tags (
    id text NOT NULL,
    tenant_id text NOT NULL,
    name text NOT NULL,
    color text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.task_tags OWNER TO postgres;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id text NOT NULL,
    tenant_id text NOT NULL,
    project_id text NOT NULL,
    parent_task_id text,
    title text NOT NULL,
    description text,
    status_id text,
    priority_id text,
    assignee_tenant_user_id text,
    reporter_tenant_user_id text,
    team_id text,
    start_date timestamp(3) without time zone,
    due_date timestamp(3) without time zone,
    completed_at timestamp(3) without time zone,
    estimated_minutes integer,
    spent_minutes integer DEFAULT 0 NOT NULL,
    story_points integer,
    kanban_position integer DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_blocked boolean DEFAULT false NOT NULL,
    blocked_reason text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    archived_at timestamp(3) without time zone
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: team_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.team_members (
    id text NOT NULL,
    tenant_id text NOT NULL,
    team_id text NOT NULL,
    tenant_user_id text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.team_members OWNER TO postgres;

--
-- Name: teams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.teams (
    id text NOT NULL,
    tenant_id text NOT NULL,
    name text NOT NULL,
    description text,
    manager_tenant_user_id text,
    color text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.teams OWNER TO postgres;

--
-- Name: tenant_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_users (
    id text NOT NULL,
    tenant_id text NOT NULL,
    user_id text NOT NULL,
    role_id text,
    job_title text,
    department text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    status public."TenantUserStatus" DEFAULT 'ACTIVE'::public."TenantUserStatus" NOT NULL,
    must_change_password boolean DEFAULT false NOT NULL,
    last_invite_at timestamp(3) without time zone,
    disabled_at timestamp(3) without time zone,
    disabled_reason text
);


ALTER TABLE public.tenant_users OWNER TO postgres;

--
-- Name: tenants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenants (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    legal_name text,
    document_number text,
    email text,
    phone text,
    status public."TenantStatus" DEFAULT 'ACTIVE'::public."TenantStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.tenants OWNER TO postgres;

--
-- Name: token_denylist; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.token_denylist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token_hash text NOT NULL,
    user_id uuid,
    reason text,
    expires_at timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.token_denylist OWNER TO postgres;

--
-- Name: usage_counters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usage_counters (
    id text NOT NULL,
    tenant_id text NOT NULL,
    metric_code text NOT NULL,
    current_value integer DEFAULT 0 NOT NULL,
    period_start timestamp(3) without time zone,
    period_end timestamp(3) without time zone,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.usage_counters OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    avatar_url text,
    phone text,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
aafb8fc9-81e9-49ee-ac0c-c3645f7c886e	d43add2e397c325496e60d8872cf003ef865b9f2c1c1b3b5a723806fb2ef48d3	2026-08-16 22:13:43.714776+00	20260310094823_init	\N	\N	2026-08-16 22:13:43.427185+00	1
4a4558d7-e7a0-4eef-a1a0-f2bfd5598bb9	1f9a0b5d4d72f0cb00d345299fd2ae4a85bcd380aa916877a73873fbe3de984c	2026-08-16 22:13:43.733988+00	20260310140022_add_email_settings	\N	\N	2026-08-16 22:13:43.716317+00	1
76ba33b4-e3a2-4c64-be73-fee426bf6802	28b7fe3a9fa91e9e7869c72e1903f76da65f72adc5fbb4491bb3a0815059e358	2026-08-16 22:13:43.740682+00	20260624120000_email_password_gcm	\N	\N	2026-08-16 22:13:43.73551+00	1
9ed612e8-5a78-416b-99d4-17ccb16bb1c2	560d23c513e4be4a5ffea688d10df3932c239e84afaa555bc51c4ba420d9dcbe	2026-08-16 22:13:43.771762+00	20260624130000_refresh_tokens_and_login_attempts	\N	\N	2026-08-16 22:13:43.742566+00	1
941401ed-c113-48c6-b0ad-e878b04632e3	c9b6f568f098a2140c3eee0ed8c39d5dabd9b2630173943fc5cbebc6e9a5de72	2026-08-16 22:13:43.782072+00	20260625000000_tenant_user_status_fields	\N	\N	2026-08-16 22:13:43.773298+00	1
7f98318c-2051-4671-aa8d-f3137ba4a9fa	d6730c6938476afa1b33b6ca93e6a075a93cbac0079e31fdafa036f761d6dc77	2026-08-16 22:13:43.790826+00	20260626145553_projects_default_active	\N	\N	2026-08-16 22:13:43.783687+00	1
b2eca656-1caa-44bf-a461-678e29edf40b	683196dd3d0b7c6c320723d6ae91ce3d98a8269d985ef0e42ae882df284ae825	2026-08-16 22:13:43.800843+00	20260629124044_email_tenant_settings	\N	\N	2026-08-16 22:13:43.792458+00	1
62773926-62da-467f-a0aa-a995610e1c00	8647b722ca65afb08c1e702be99c11a00c6a267d0667571db32e60f77434470e	2026-08-16 22:13:43.821482+00	20260629130000_email_tenant_settings	\N	\N	2026-08-16 22:13:43.802762+00	1
0498cb4b-df3b-4653-9d28-0ee945fc9ed7	bb9861a15240531fd68f64f13ceae221d7639dde997b689998460e7c67caa79b	2026-08-16 22:13:43.839131+00	20260630150000_token_denylist	\N	\N	2026-08-16 22:13:43.823123+00	1
e6516715-399e-4dd3-a7f4-809a12a9298d	9241c2f2157a9706b09e529b584e2de05b617c4c7ed5c489b194af1264c0de78	2026-08-17 18:22:59.254403+00	20260817120000_add_daily_routine_tables		\N	2026-08-17 18:22:59.254403+00	0
\.


--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activity_logs (id, tenant_id, actor_tenant_user_id, entity_type, entity_id, action, old_values_json, new_values_json, created_at) FROM stdin;
bb87bad7-0fa9-438f-b52d-494a50f4ca30	94ecfea0-859e-45da-a1d0-e0f238211a2f	\N	Task	df5d4373-287b-4c52-bde6-8da8704ad8f3	STATUS_CHANGED	{"statusId":"66c96a35-f8d0-4816-a3f5-8099dca0a159"}	{"statusId":"d0192ddd-c1a3-4ab7-b3ba-eb77d1e3f591"}	2026-08-17 17:38:48.549
a8b928dd-3d23-4ac0-97b6-d21cc2c1a6f9	94ecfea0-859e-45da-a1d0-e0f238211a2f	\N	Task	ef610797-c553-4c24-b236-d5767a1f3cc3	STATUS_CHANGED	{"statusId":"66c96a35-f8d0-4816-a3f5-8099dca0a159"}	{"statusId":"3a30c352-66e0-482a-9f13-81cb883f6bb8"}	2026-08-17 17:38:50.765
083eca07-8f6a-45ba-9a03-90f8281beb7e	94ecfea0-859e-45da-a1d0-e0f238211a2f	ea876fef-3d51-4a83-89c5-6506d9a19d58	DailyRoutine	6fa20cc0-59f1-4fae-b687-66da5b240400	ROUTINE_COMPLETED	\N	{"routineItemId":"6fa20cc0-59f1-4fae-b687-66da5b240400","title":"Conferir e-mails e prioridades do dia","assignedTo":"ea876fef-3d51-4a83-89c5-6506d9a19d58","date":"2026-08-18","notes":null}	2026-08-18 10:49:25.984
69caeb5d-0371-44be-8c22-fff6dd48bf97	94ecfea0-859e-45da-a1d0-e0f238211a2f	ea876fef-3d51-4a83-89c5-6506d9a19d58	DailyRoutine	648dd63d-de4a-4dcd-bcd1-c64bc5d38597	ROUTINE_COMPLETED	\N	{"routineItemId":"648dd63d-de4a-4dcd-bcd1-c64bc5d38597","title":"Alinhar tarefas da equipe na Daily","assignedTo":"ea876fef-3d51-4a83-89c5-6506d9a19d58","date":"2026-08-18","notes":null}	2026-08-18 10:49:29.837
f497f1e2-ffba-4390-983d-313212c45bab	94ecfea0-859e-45da-a1d0-e0f238211a2f	\N	Task	0b94e2d8-273b-4be0-8e68-c04c035c023c	STATUS_CHANGED	{"statusId":"66c96a35-f8d0-4816-a3f5-8099dca0a159"}	{"statusId":"d0192ddd-c1a3-4ab7-b3ba-eb77d1e3f591"}	2026-08-18 10:49:46.872
c97a3fd2-4665-4901-a014-8dc6decc2037	94ecfea0-859e-45da-a1d0-e0f238211a2f	\N	Task	8899cff6-06a7-4f35-9560-da222c524521	STATUS_CHANGED	{"statusId":"66c96a35-f8d0-4816-a3f5-8099dca0a159"}	{"statusId":"331e7776-a789-435d-8fd1-39313147d82e"}	2026-08-18 10:49:48.932
f639b63e-d958-405a-89af-02c1903b8990	94ecfea0-859e-45da-a1d0-e0f238211a2f	\N	Task	ef610797-c553-4c24-b236-d5767a1f3cc3	STATUS_CHANGED	{"statusId":"3a30c352-66e0-482a-9f13-81cb883f6bb8"}	{"statusId":"d53f6d1f-b6fb-45ea-9a00-18c8838a5740"}	2026-08-18 10:49:52.575
5ffe0b19-e355-4f21-9f66-98aea510e40f	94ecfea0-859e-45da-a1d0-e0f238211a2f	\N	Task	0b94e2d8-273b-4be0-8e68-c04c035c023c	STATUS_CHANGED	{"oldStatusName":"Em Execu├º├úo"}	{"taskTitle":"Homologar autentica├º├úo","projectName":"Implanta├º├úo Inicial","projectCode":"IMPL-001","newStatusName":"Revis├úo"}	2026-08-18 11:28:18.279
587fa573-bd93-4dc3-bc23-69f8b6c87e9c	94ecfea0-859e-45da-a1d0-e0f238211a2f	\N	Task	ef610797-c553-4c24-b236-d5767a1f3cc3	STATUS_CHANGED	{"oldStatusName":"Conclu├¡do"}	{"taskTitle":"Criar identidade visual","projectName":"Implanta├º├úo Inicial","projectCode":"IMPL-001","newStatusName":"Backlog"}	2026-08-18 11:28:20.795
bdf78e3d-be99-4b73-a94e-1824a1b327f5	94ecfea0-859e-45da-a1d0-e0f238211a2f	\N	Task	8899cff6-06a7-4f35-9560-da222c524521	STATUS_CHANGED	{"oldStatusName":"Backlog"}	{"taskTitle":"Definir fluxo de kanban","projectName":"Implanta├º├úo Inicial","projectCode":"IMPL-001","newStatusName":"A Fazer"}	2026-08-18 11:28:22.524
145037a2-5bd6-4679-a28b-126476f0d5f3	94ecfea0-859e-45da-a1d0-e0f238211a2f	\N	Task	13ccab17-02d2-4248-aff0-c773c6617533	STATUS_CHANGED	{"oldStatusName":"A Fazer"}	{"taskTitle":"Publicar vers├úo alfa","projectName":"Implanta├º├úo Inicial","projectCode":"IMPL-001","newStatusName":"Conclu├¡do"}	2026-08-18 11:28:25.787
d9d90902-d239-400b-a115-3e494edb8477	94ecfea0-859e-45da-a1d0-e0f238211a2f	\N	Task	0b94e2d8-273b-4be0-8e68-c04c035c023c	STATUS_CHANGED	{"oldStatusName":"Revis├úo"}	{"taskTitle":"Homologar autentica├º├úo","projectName":"Implanta├º├úo Inicial","projectCode":"IMPL-001","newStatusName":"A Fazer"}	2026-08-18 11:28:27.178
c05a3974-a87a-48cf-b92d-627466d9f86e	94ecfea0-859e-45da-a1d0-e0f238211a2f	\N	Task	cdd21cfe-6d5e-491b-80a9-f8116e4fac68	TASK_CREATED	\N	{"taskTitle":"teste de cria├º├ú","projectName":"Implanta├º├úo Inicial","projectCode":"IMPL-001","statusName":"A Fazer"}	2026-08-18 11:29:37.713
117901be-28fc-4812-ade3-4bdb1d7f512e	94ecfea0-859e-45da-a1d0-e0f238211a2f	\N	Task	cdd21cfe-6d5e-491b-80a9-f8116e4fac68	STATUS_CHANGED	{}	{"taskTitle":"teste de cria├º├ú","projectName":"Implanta├º├úo Inicial","projectCode":"IMPL-001","newPriorityName":"Urgente"}	2026-08-18 12:32:46.445
7e72b46a-096a-445b-96eb-5fa8b330a80a	94ecfea0-859e-45da-a1d0-e0f238211a2f	\N	Task	0b94e2d8-273b-4be0-8e68-c04c035c023c	STATUS_CHANGED	{"oldStatusName":"A Fazer"}	{"taskTitle":"Homologar autentica├º├úo","projectName":"Implanta├º├úo Inicial","projectCode":"IMPL-001","newStatusName":"Conclu├¡do"}	2026-08-18 12:33:21.95
3bf6ed88-ff63-447b-ae9c-8f8312d5ca0d	94ecfea0-859e-45da-a1d0-e0f238211a2f	\N	Task	df5d4373-287b-4c52-bde6-8da8704ad8f3	STATUS_CHANGED	{"oldStatusName":"Em Execu├º├úo"}	{"taskTitle":"Configurar VPS","projectName":"Implanta├º├úo Inicial","projectCode":"IMPL-001","newStatusName":"Conclu├¡do"}	2026-08-18 12:33:23.707
59d638f9-8349-424d-970c-3f75ebd0d1f3	94ecfea0-859e-45da-a1d0-e0f238211a2f	\N	Task	8899cff6-06a7-4f35-9560-da222c524521	STATUS_CHANGED	{"oldStatusName":"A Fazer"}	{"taskTitle":"Definir fluxo de kanban","projectName":"Implanta├º├úo Inicial","projectCode":"IMPL-001","newStatusName":"Conclu├¡do"}	2026-08-18 12:33:25.393
1504cee6-c73a-48b7-b5f9-27d1cf7f2135	94ecfea0-859e-45da-a1d0-e0f238211a2f	\N	Task	cdd21cfe-6d5e-491b-80a9-f8116e4fac68	STATUS_CHANGED	{"oldStatusName":"A Fazer"}	{"taskTitle":"teste de cria├º├ú","projectName":"Implanta├º├úo Inicial","projectCode":"IMPL-001","newStatusName":"Conclu├¡do"}	2026-08-18 12:33:27.151
014c70e7-1c2a-403f-b4ae-b9dae51fe382	94ecfea0-859e-45da-a1d0-e0f238211a2f	\N	Task	0b94e2d8-273b-4be0-8e68-c04c035c023c	STATUS_CHANGED	{"oldPriorityName":"Normal"}	{"taskTitle":"Homologar autentica├º├úo","projectName":"Implanta├º├úo Inicial","projectCode":"IMPL-001","newPriorityName":"Urgente"}	2026-08-18 12:36:05.606
\.


--
-- Data for Name: attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.attachments (id, tenant_id, task_id, project_id, uploaded_by_tenant_user_id, file_name, file_path, mime_type, file_size, created_at) FROM stdin;
f8d1862e-0918-440c-9a44-f5b4b3c19b4f	94ecfea0-859e-45da-a1d0-e0f238211a2f	cdd21cfe-6d5e-491b-80a9-f8116e4fac68	\N	ea876fef-3d51-4a83-89c5-6506d9a19d58	CXC5I26_Conc_20260618.pdf	uploads/94ecfea0-859e-45da-a1d0-e0f238211a2f/1787053938682-CXC5I26_Conc_20260618.pdf	application/pdf	61882	2026-08-18 11:52:18.684
0ddd5670-2fef-4584-8ad5-131f5cc724b2	94ecfea0-859e-45da-a1d0-e0f238211a2f	cdd21cfe-6d5e-491b-80a9-f8116e4fac68	\N	ea876fef-3d51-4a83-89c5-6506d9a19d58	cronograma Fabiano.xlsx	uploads/94ecfea0-859e-45da-a1d0-e0f238211a2f/1787054612758-cronograma Fabiano.xlsx	application/vnd.openxmlformats-officedocument.spreadsheetml.sheet	10815	2026-08-18 12:03:32.76
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, tenant_id, actor_user_id, action, target_type, target_id, ip_address, user_agent, metadata_json, created_at) FROM stdin;
a0d0e544-4efd-4d21-984d-cb498b821c67	94ecfea0-859e-45da-a1d0-e0f238211a2f	8b4ce856-138c-4b1d-b609-23c565929df8	user.create	TenantUser	38051273-f879-4c29-a77d-f950f1fba8ec	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"email":"teste@teste.com.br","roleId":null,"inviteMode":false}	2026-08-16 22:37:29.609
bd3ccf45-0eac-43d7-aacc-c97e8fa6698d	94ecfea0-859e-45da-a1d0-e0f238211a2f	8b4ce856-138c-4b1d-b609-23c565929df8	REFRESH_TOKEN_REUSE_DETECTED	RefreshToken	bbe21854-5d89-43a0-8c9c-3ab28ed3dd75	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"family":"49ef75dd-22b6-4839-a84d-bc53a4fee22e"}	2026-08-18 12:07:19.521
17dc76cd-4b5b-4a04-9bf1-d772e2cd05d0	94ecfea0-859e-45da-a1d0-e0f238211a2f	8b4ce856-138c-4b1d-b609-23c565929df8	REFRESH_TOKEN_REUSE_DETECTED	RefreshToken	bbe21854-5d89-43a0-8c9c-3ab28ed3dd75	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"family":"49ef75dd-22b6-4839-a84d-bc53a4fee22e"}	2026-08-18 12:07:20.59
bd0de2d5-b7bc-4f98-8528-fab977b7c9fd	94ecfea0-859e-45da-a1d0-e0f238211a2f	8b4ce856-138c-4b1d-b609-23c565929df8	REFRESH_TOKEN_REUSE_DETECTED	RefreshToken	bbe21854-5d89-43a0-8c9c-3ab28ed3dd75	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"family":"49ef75dd-22b6-4839-a84d-bc53a4fee22e"}	2026-08-18 12:07:24.118
73abbb01-fc07-4c9f-b4db-7beda8c1d0ec	94ecfea0-859e-45da-a1d0-e0f238211a2f	8b4ce856-138c-4b1d-b609-23c565929df8	REFRESH_TOKEN_REUSE_DETECTED	RefreshToken	bbe21854-5d89-43a0-8c9c-3ab28ed3dd75	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"family":"49ef75dd-22b6-4839-a84d-bc53a4fee22e"}	2026-08-18 12:07:25.156
7557af2a-31f2-41f9-b89d-f3bffba3b036	94ecfea0-859e-45da-a1d0-e0f238211a2f	8b4ce856-138c-4b1d-b609-23c565929df8	REFRESH_TOKEN_REUSE_DETECTED	RefreshToken	bbe21854-5d89-43a0-8c9c-3ab28ed3dd75	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"family":"49ef75dd-22b6-4839-a84d-bc53a4fee22e"}	2026-08-18 12:07:26.195
e7f727f5-02d7-4a96-8d8c-0d5e23cc863c	94ecfea0-859e-45da-a1d0-e0f238211a2f	8b4ce856-138c-4b1d-b609-23c565929df8	REFRESH_TOKEN_REUSE_DETECTED	RefreshToken	bbe21854-5d89-43a0-8c9c-3ab28ed3dd75	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"family":"49ef75dd-22b6-4839-a84d-bc53a4fee22e"}	2026-08-18 12:07:32.298
b97867ae-a674-42fb-9c8d-27855ef6b4cf	94ecfea0-859e-45da-a1d0-e0f238211a2f	8b4ce856-138c-4b1d-b609-23c565929df8	REFRESH_TOKEN_REUSE_DETECTED	RefreshToken	bbe21854-5d89-43a0-8c9c-3ab28ed3dd75	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"family":"49ef75dd-22b6-4839-a84d-bc53a4fee22e"}	2026-08-18 12:07:33.39
c23902f3-8b74-4e5f-8808-ca6d782c929b	94ecfea0-859e-45da-a1d0-e0f238211a2f	8b4ce856-138c-4b1d-b609-23c565929df8	REFRESH_TOKEN_REUSE_DETECTED	RefreshToken	bbe21854-5d89-43a0-8c9c-3ab28ed3dd75	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"family":"49ef75dd-22b6-4839-a84d-bc53a4fee22e"}	2026-08-18 12:07:37.177
755a145e-ff48-4471-94c7-f14b6b7b0821	94ecfea0-859e-45da-a1d0-e0f238211a2f	8b4ce856-138c-4b1d-b609-23c565929df8	REFRESH_TOKEN_REUSE_DETECTED	RefreshToken	bbe21854-5d89-43a0-8c9c-3ab28ed3dd75	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"family":"49ef75dd-22b6-4839-a84d-bc53a4fee22e"}	2026-08-18 12:07:37.232
\.


--
-- Data for Name: automations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.automations (id, tenant_id, name, description, trigger_type, conditions_json, actions_json, is_active, created_by_tenant_user_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: contacts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contacts (id, tenant_id, name, company, department, role, email, phone, mobile, extension, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: custom_field_values; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.custom_field_values (id, tenant_id, custom_field_id, entity_id, value_text, value_number, value_date, value_boolean, value_json, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: custom_fields; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.custom_fields (id, tenant_id, entity_type, name, field_type, config_json, is_required, created_at) FROM stdin;
\.


--
-- Data for Name: daily_routine_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.daily_routine_items (id, tenant_id, assigned_tenant_user_id, created_by_id, title, description, scheduled_time, is_active, created_at, updated_at) FROM stdin;
6fa20cc0-59f1-4fae-b687-66da5b240400	94ecfea0-859e-45da-a1d0-e0f238211a2f	ea876fef-3d51-4a83-89c5-6506d9a19d58	ea876fef-3d51-4a83-89c5-6506d9a19d58	Conferir e-mails e prioridades do dia	Revisar caixa de entrada e responder solicita├º├Áes urgentes.	08:30	t	2026-08-16 22:22:25.945	2026-08-16 22:22:25.945
648dd63d-de4a-4dcd-bcd1-c64bc5d38597	94ecfea0-859e-45da-a1d0-e0f238211a2f	ea876fef-3d51-4a83-89c5-6506d9a19d58	ea876fef-3d51-4a83-89c5-6506d9a19d58	Alinhar tarefas da equipe na Daily	Participar da reuni├úo di├íria de alinhamento de tarefas.	09:00	t	2026-08-16 22:22:25.95	2026-08-16 22:22:25.95
f6a40ca5-8a35-4bf1-955b-798e2a5b45a8	94ecfea0-859e-45da-a1d0-e0f238211a2f	ea876fef-3d51-4a83-89c5-6506d9a19d58	ea876fef-3d51-4a83-89c5-6506d9a19d58	Atualizar progresso dos projetos no Quadro	Garantir que os status das tarefas no Kanban estejam atualizados.	14:00	t	2026-08-16 22:22:25.952	2026-08-16 22:22:25.952
9a47a0c0-60d8-4054-8844-8cf52be45a07	94ecfea0-859e-45da-a1d0-e0f238211a2f	ea876fef-3d51-4a83-89c5-6506d9a19d58	ea876fef-3d51-4a83-89c5-6506d9a19d58	Revisar logs de auditoria e relat├│rios di├írios	Verificar m├®tricas de desempenho e pend├¬ncias do sistema.	17:00	t	2026-08-16 22:22:25.954	2026-08-16 22:22:25.954
c06cf5c5-341b-4608-b387-a27ddda24306	94ecfea0-859e-45da-a1d0-e0f238211a2f	38051273-f879-4c29-a77d-f950f1fba8ec	ea876fef-3d51-4a83-89c5-6506d9a19d58	abrir a porta	\N	07:00	t	2026-08-17 18:07:12.716	2026-08-17 18:07:31.556
4fa2c227-fb0b-43c8-97f6-689703339987	94ecfea0-859e-45da-a1d0-e0f238211a2f	38051273-f879-4c29-a77d-f950f1fba8ec	ea876fef-3d51-4a83-89c5-6506d9a19d58	desligar o alarme	\N	06:02	t	2026-08-17 18:07:50.08	2026-08-17 18:07:50.08
73ae3bae-4e48-4d15-854b-650affc12742	94ecfea0-859e-45da-a1d0-e0f238211a2f	38051273-f879-4c29-a77d-f950f1fba8ec	ea876fef-3d51-4a83-89c5-6506d9a19d58	tarefa 01	\N	09:43	t	2026-08-17 19:43:39.093	2026-08-17 19:43:39.093
5af9f9c4-fa02-4407-8109-b40c6093f5a7	94ecfea0-859e-45da-a1d0-e0f238211a2f	38051273-f879-4c29-a77d-f950f1fba8ec	ea876fef-3d51-4a83-89c5-6506d9a19d58	tarefa 02	\N	16:43	t	2026-08-17 19:43:54.173	2026-08-17 19:43:54.173
\.


--
-- Data for Name: daily_routine_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.daily_routine_logs (id, tenant_id, routine_item_id, tenant_user_id, date, completed_at, is_completed, notes) FROM stdin;
0a22aa40-a0f6-4ee4-be25-e67919d95495	94ecfea0-859e-45da-a1d0-e0f238211a2f	6fa20cc0-59f1-4fae-b687-66da5b240400	ea876fef-3d51-4a83-89c5-6506d9a19d58	2026-08-17	2026-08-17 19:12:38.619	t	\N
84192f44-ce8c-4443-b80f-5c89a4e6eb0f	94ecfea0-859e-45da-a1d0-e0f238211a2f	648dd63d-de4a-4dcd-bcd1-c64bc5d38597	ea876fef-3d51-4a83-89c5-6506d9a19d58	2026-08-17	2026-08-17 19:12:44.239	t	\N
916cbc49-5d96-46d9-a143-d6f87bad3565	94ecfea0-859e-45da-a1d0-e0f238211a2f	f6a40ca5-8a35-4bf1-955b-798e2a5b45a8	ea876fef-3d51-4a83-89c5-6506d9a19d58	2026-08-17	2026-08-17 19:12:45.567	t	\N
1a21efaf-cf19-4a08-9774-922eaa8212ce	94ecfea0-859e-45da-a1d0-e0f238211a2f	9a47a0c0-60d8-4054-8844-8cf52be45a07	ea876fef-3d51-4a83-89c5-6506d9a19d58	2026-08-17	2026-08-17 19:20:43.379	t	\N
3c0d8513-6ae9-41ac-a466-bd9ed15faf9d	94ecfea0-859e-45da-a1d0-e0f238211a2f	c06cf5c5-341b-4608-b387-a27ddda24306	38051273-f879-4c29-a77d-f950f1fba8ec	2026-08-17	2026-08-17 19:23:22.863	t	\N
23cbe93d-3af3-4986-b580-01d03e329ac7	94ecfea0-859e-45da-a1d0-e0f238211a2f	4fa2c227-fb0b-43c8-97f6-689703339987	38051273-f879-4c29-a77d-f950f1fba8ec	2026-08-17	2026-08-17 19:38:23.533	t	\N
8549b427-3838-4ec4-bb29-eb99f7649e62	94ecfea0-859e-45da-a1d0-e0f238211a2f	73ae3bae-4e48-4d15-854b-650affc12742	38051273-f879-4c29-a77d-f950f1fba8ec	2026-08-17	2026-08-17 19:48:06.612	t	\N
9715d74c-14b0-4e65-bb98-4886dda559c2	94ecfea0-859e-45da-a1d0-e0f238211a2f	5af9f9c4-fa02-4407-8109-b40c6093f5a7	38051273-f879-4c29-a77d-f950f1fba8ec	2026-08-17	2026-08-17 19:48:08.906	t	\N
38c8fe0e-a089-4c24-8b29-9625dbd054f1	94ecfea0-859e-45da-a1d0-e0f238211a2f	6fa20cc0-59f1-4fae-b687-66da5b240400	ea876fef-3d51-4a83-89c5-6506d9a19d58	2026-08-18	2026-08-18 10:49:25.977	t	\N
1977bfc2-19a8-42f1-bc80-21cdb3fe8431	94ecfea0-859e-45da-a1d0-e0f238211a2f	648dd63d-de4a-4dcd-bcd1-c64bc5d38597	ea876fef-3d51-4a83-89c5-6506d9a19d58	2026-08-18	2026-08-18 10:49:29.832	t	\N
\.


--
-- Data for Name: email_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_settings (id, tenant_id, tenant_user_id, protocol, created_at, updated_at, password_ciphertext, password_iv, password_auth_tag) FROM stdin;
\.


--
-- Data for Name: email_tenant_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_tenant_settings (id, tenant_id, email_domain, detection_mode, preset_key, imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure, updated_by_tenant_user_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: event_attendees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.event_attendees (id, tenant_id, event_id, tenant_user_id, response_status) FROM stdin;
\.


--
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.events (id, tenant_id, title, description, type, start_at, end_at, all_day, created_by_tenant_user_id, related_project_id, related_task_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: login_attempts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.login_attempts (id, email, ip_address, user_agent, success, reason, created_at) FROM stdin;
9db896fa-f779-4812-9b05-bca188dfd622	teste@teste.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	f	user_not_found	2026-08-16 22:29:48.087
05a28b0b-52d3-4437-8283-d7f30f57cb78	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:30:13.596
bb932c6b-512b-41b4-9edb-02629690f005	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:30:20.459
d80816d2-13cb-4e77-ac4e-12aa9bdf0545	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:31:44.924
b25ad28b-2c68-4a63-a536-a567f9b3f574	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:31:48.013
81d9071b-a102-4359-8792-7ac26d640077	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:31:49.742
5b635741-2b82-409b-b7cb-06f52a83ed9f	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:31:51.091
82baeb29-4c0e-4b15-8672-7b6dee41c9f8	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:31:52.3
64ed635a-575c-45f2-a94c-fd0884e8d6e5	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:31:53.523
bbea3f44-c217-4e4b-99d4-8b04f68519d0	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:31:54.79
e8eadf16-8f9c-49be-85b6-9b69565f4f1a	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:31:56.093
1b3fdd16-090f-4005-9b68-9727a5a8a11a	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:31:57.178
cf03e3b2-3cff-4462-85f8-5ad5029d38a6	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:32:23.785
a3cfde7a-a743-4cad-bc94-916a853ac799	admin@quadrodomane.local	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	f	user_not_found	2026-08-16 22:35:16.113
61468e6a-6bab-4cae-8b37-11d617aed2b7	admin@quadrodomane.local	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	f	user_not_found	2026-08-16 22:35:17.228
adc0ec93-9c5e-4783-9758-bf3ea542135a	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:35:35.375
ac2da53e-5f73-4f00-9050-6aeb24c05cc2	teste@teste.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	f	user_not_found	2026-08-16 22:36:12.143
3b38368b-cfec-4638-95f8-e52d3f701321	teste@teste.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	f	user_not_found	2026-08-16 22:36:13.271
ab3b194e-d78c-4ddf-9065-770825fb8e2e	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:37:00.473
b6f5dfa2-29a3-41bc-959c-f8b6d36d738f	teste@teste.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:37:33.918
40035cb6-f250-49a5-bb7b-4d79d8e5eab1	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:37:54.992
9493ed3e-f012-410e-ba56-3063bbec6354	teste@teste.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:39:00.555
d91d8d94-a6b9-476e-83ea-4710360491a5	teste@teste.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:52:41.037
26b07b10-2ed2-420a-b145-7a753ce32fbd	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:53:09.288
ba63e19f-906b-4eb3-bc24-7851d4b42112	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:53:10.878
c865655c-ef9f-442c-a5dc-a6dcaba90443	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:53:24.832
44e57396-96e1-4788-9585-82fc56743abc	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 22:53:27.17
7f93ceca-895e-4dea-8d85-fd9e32f2e774	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 23:08:14.344
398bb0b9-8455-4886-b5ab-5c49dd484060	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 23:09:36.015
15789805-9165-4f66-841a-ba3bb6f1c5bf	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 23:09:38.396
09eb2f70-e529-4c33-960e-d9fe374b2c39	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-16 23:09:39.862
4046b931-3c4e-463e-9e17-2512a0f597fd	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-17 13:41:31.448
4e0176d1-b816-4845-b61a-2e58c04029d7	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-17 13:42:41.61
ce850afb-a612-47d9-830a-6b752bd81f09	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-17 13:42:48.207
963f1c91-ef00-44cf-a945-88d9097b31c3	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-17 13:53:18.249
6f8bbce9-6f8e-4840-8bd4-ea3ff3e7cd04	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-17 13:53:20.533
e6a1d1f2-c4f4-4779-af0c-a4275718c1bc	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-17 14:54:19.825
c97322f7-f1ce-432f-83fd-082fcb4f30a5	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-17 14:54:28.794
fc05e107-920b-449f-ab68-39c7c5b4906b	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-17 17:19:50.72
8014001c-694c-426a-960a-a8141bd3587f	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-17 17:19:52.454
5330860b-feec-4ee1-9614-e9a2c9189173	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-17 17:38:21.714
94faa90e-086b-4344-bb04-fc720e886291	teste@teste.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-17 18:09:08.845
7a026e0c-a4ba-4901-8f60-36ddc77766f7	teste@teste.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-17 19:11:33.9
cc62ba49-d8e1-410f-abce-a9fd00075007	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-17 19:12:20.79
9df10094-7efa-4be2-b1dc-736c1b11c81e	teste@teste.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-17 19:20:59.811
37fd6505-4ffb-4adb-8897-295d4da02b02	admin@montemoria.com.br	127.0.0.1	curl/8.21.0	t	\N	2026-08-17 19:22:10.909
5d7f90f4-4dac-4546-9839-53801f040cc2	teste@teste.com.br	127.0.0.1	curl/8.21.0	t	\N	2026-08-17 19:22:50.47
28d36cdd-eb9e-4692-8131-5856dd0997ce	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; pt-BR) PowerShell/7.6.5	t	\N	2026-08-17 19:34:18.381
c63db97c-584f-4b53-8f37-7422bea1bb10	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; pt-BR) PowerShell/7.6.5	t	\N	2026-08-17 19:37:18.514
d5d88f4c-c80b-4849-a18e-ff63c6c9a048	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-17 19:38:48.116
b00514d3-62ed-47cc-b659-af07d12cf30d	teste@teste.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-17 19:47:49.56
9b0994ad-8ad3-4ba7-98c9-f56000d32a8a	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-17 20:02:48.678
7108c941-e6fa-4d2a-b971-c850942bfe31	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-18 11:50:37.496
fc88692f-4d0e-4d5c-b5a6-f7dcc1fd5974	teste@teste.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-18 12:04:44.675
8af379cb-619c-4374-824e-21bdd526b68a	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-18 12:05:12.597
fb173343-afa3-4f15-9394-7a9dbcae1590	teste@teste.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-18 12:05:51.556
fd37b3da-2eae-4b1f-b861-d4b33bb7950c	admin@montemoria.com.br	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	t	\N	2026-08-18 12:07:55.868
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, tenant_id, tenant_user_id, type, title, message, payload_json, is_read, read_at, created_at) FROM stdin;
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.permissions (id, code, name, description, module) FROM stdin;
fc479433-f0a3-43b9-97a9-bacafe2155cb	auth.login	Login	\N	auth
f939a4c7-6b82-4c03-b801-4038e8c965f2	auth.logout	Logout	\N	auth
285237b4-a1e8-4b6c-8afb-8aa2b2fb6dcc	auth.refresh	Refresh Token	\N	auth
832af678-767f-411a-a2ad-27142d3cc634	dashboard.view	Ver Dashboard	\N	dashboard
5f40dad5-446b-4513-8276-eb9856b79765	users.view	Ver Usu├írios	\N	users
be19f16f-894e-4cd9-b6ff-f366820ace8f	users.create	Criar Usu├írios	\N	users
65288b42-9876-459c-97e7-b87afc903915	users.edit	Editar Usu├írios	\N	users
bfd98f23-49ed-4b68-b5ef-2b2e402584ad	users.disable	Desabilitar Usu├írios	\N	users
5be906a3-989f-4d38-82ff-d5e7b683ad83	roles.view	Ver Pap├®is	\N	roles
dce3122c-e11e-4bf3-a971-6cdf18252da2	roles.create	Criar Pap├®is	\N	roles
456c5421-2841-4552-a481-a40a12f1fad3	roles.edit	Editar Pap├®is	\N	roles
32376878-d90e-4994-9250-9bf10b7f37bc	roles.assign	Atribuir Pap├®is	\N	roles
87d1b2a2-9559-4c41-8a4f-3093ae7045c1	teams.view	Ver Equipes	\N	teams
0a64734f-8b22-4b7b-83ef-08e9feeb8cb3	teams.create	Criar Equipes	\N	teams
00d114a0-9b40-473a-9ee7-6ea8e920259c	teams.edit	Editar Equipes	\N	teams
53eecae5-af39-4a97-9339-a21d04e48b67	teams.delete	Excluir Equipes	\N	teams
db1e2bfb-470d-4ed2-b4b3-eade1ca2b590	teams.manage_members	Gerenciar Membros	\N	teams
ca3cddbb-193b-4ce8-8841-8227003ad4e6	projects.view	Ver Projetos	\N	projects
4af38e99-0c50-4964-8a30-d0889aac66fc	projects.create	Criar Projetos	\N	projects
9fe87311-0099-42da-ae34-01f8264a5e14	projects.edit	Editar Projetos	\N	projects
feba9588-dd73-42db-a059-efe3d819246e	projects.archive	Arquivar Projetos	\N	projects
fa03d71a-c030-495f-a2d8-8c0441282f14	projects.delete	Excluir Projetos	\N	projects
6471306e-d3b2-4e2d-a86e-7064af154f65	projects.manage_members	Gerenciar Membros do Projeto	\N	projects
da0eb437-f7df-496b-8425-5f978598aca1	projects.manage_views	Gerenciar Visualiza├º├Áes	\N	projects
f1c654d6-868c-414b-b5f3-04414f62a907	tasks.view	Ver Tarefas	\N	tasks
05890853-0a20-48cf-90c7-794e9ae53bc0	tasks.create	Criar Tarefas	\N	tasks
0144d39f-d7e3-49bf-9029-4841035e9be6	tasks.edit	Editar Tarefas	\N	tasks
783f362a-c0e5-49fa-9231-8462743d7fa0	tasks.delete	Excluir Tarefas	\N	tasks
3a075d4b-1a9c-4ad6-af9c-2f6ef137a77d	tasks.move	Mover Tarefas	\N	tasks
bc41f972-fb09-4425-a45a-23bfc17a64df	tasks.assign	Atribuir Tarefas	\N	tasks
b089bb60-62dd-4fac-8a31-8e017914b6a9	tasks.comment	Comentar Tarefas	\N	tasks
2042972a-d6a3-4288-963d-f40ce1974b59	tasks.checklist_manage	Gerenciar Checklists	\N	tasks
b3d195ca-147d-4a7c-bd48-a794d0b22eb1	tasks.attachments_manage	Gerenciar Anexos	\N	tasks
8b45bb0d-5edc-4355-a3c2-60603a50fc20	tasks.change_status	Alterar Status	\N	tasks
a9360adc-0594-40e5-8e55-f33727ac75b2	tasks.change_priority	Alterar Prioridade	\N	tasks
cfabe2a9-122f-4bf4-a415-4c3525728390	calendar.view	Ver Calend├írio	\N	calendar
2536a362-925f-4231-801c-d8e9c18776aa	calendar.create	Criar Eventos	\N	calendar
6ffce1f7-8cfd-44a3-b580-9bce2edde659	calendar.edit	Editar Eventos	\N	calendar
5ed5d449-2987-451c-96f5-a9501da20448	calendar.delete	Excluir Eventos	\N	calendar
6236dc8b-5cff-4805-affc-dddcf4cafc9c	contacts.view	Ver Contatos	\N	contacts
7a52c070-ab0f-4ec4-a349-c36773e74a9a	contacts.create	Criar Contatos	\N	contacts
5e15ba4f-72b9-446c-9464-52f69685b3eb	contacts.edit	Editar Contatos	\N	contacts
ccfdcc7f-2402-4560-bf7e-2045784d637a	contacts.delete	Excluir Contatos	\N	contacts
313a46d2-6b1d-4134-89a5-3d4c9a93ba57	reports.view	Ver Relat├│rios	\N	reports
bdf198ea-8154-4997-946f-4f7f76d6f7cd	reports.export	Exportar Relat├│rios	\N	reports
4b99adad-5220-4e05-982e-ac5256ddcfcd	notifications.view	Ver Notifica├º├Áes	\N	notifications
2fd70013-7fb6-4460-a97a-d1c72e90795c	notifications.manage	Gerenciar Notifica├º├Áes	\N	notifications
76763a4c-6d88-4d66-b707-c336acb553a4	automations.view	Ver Automa├º├Áes	\N	automations
f0a0bba0-a1e1-4080-a6de-164540a36649	automations.create	Criar Automa├º├Áes	\N	automations
cc653ab1-89f9-403c-82a5-c9a9753afdc3	automations.edit	Editar Automa├º├Áes	\N	automations
0c195cc0-78f4-4b18-89ff-7340b8de75e7	automations.delete	Excluir Automa├º├Áes	\N	automations
f3d21e56-c790-4849-84d7-c8d6457aeb51	billing.view	Ver Faturamento	\N	billing
97574dd3-384f-48fb-8d2c-a2335925da01	billing.manage	Gerenciar Faturamento	\N	billing
1d0a31a7-2519-44dd-8798-bf3d94fffa29	settings.view	Ver Configura├º├Áes	\N	settings
554e3d81-ba2b-424f-94ce-4c61b04e9aa9	settings.edit	Editar Configura├º├Áes	\N	settings
21d91aef-5f63-4c5a-ba45-4a736f263ba6	audit.view	Ver Auditoria	\N	audit
e08cc8ee-fcc8-4bd0-b97a-2f1415665762	email.view	Usar E-mail	\N	email
670913f8-8091-43f4-b881-8f83b5c7c025	email.admin	Configurar Servidor de E-mail	\N	email
cc151a9f-e9f8-434c-bacc-889da36384e2	daily_routine.view	Ver Rotina Di├íria	\N	daily_routine
546b4d39-4ccb-4795-b915-7e4884849148	daily_routine.manage	Gerenciar Rotinas Di├írias	\N	daily_routine
a323fecd-c980-453f-b12e-3a1acb1d40ab	daily_routine.complete	Executar Rotina Di├íria	\N	daily_routine
\.


--
-- Data for Name: plans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.plans (id, name, description, max_users, max_projects, max_storage_mb, monthly_price, annual_price, created_at, updated_at) FROM stdin;
trial	Trial	Plano de avalia├º├úo	10	10	1024	0.00	0.00	2026-08-16 22:20:58.209	2026-08-16 22:22:25.386
starter	Starter	Plano inicial para pequenas equipes	25	50	5120	99.90	999.00	2026-08-16 22:20:58.224	2026-08-16 22:22:25.393
pro	Pro	Plano profissional para equipes em crescimento	100	500	20480	299.90	2999.00	2026-08-16 22:20:58.226	2026-08-16 22:22:25.395
enterprise	Enterprise	Plano corporativo	\N	\N	\N	999.90	9999.00	2026-08-16 22:20:58.228	2026-08-16 22:22:25.398
\.


--
-- Data for Name: project_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.project_members (id, tenant_id, project_id, tenant_user_id, role_in_project, created_at) FROM stdin;
3eeaa535-283c-4557-b12b-f5c9f2c06f1f	94ecfea0-859e-45da-a1d0-e0f238211a2f	fa49202c-9f0f-4525-b86e-f52afd002347	38051273-f879-4c29-a77d-f950f1fba8ec	\N	2026-08-18 12:05:36.987
\.


--
-- Data for Name: project_views; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.project_views (id, tenant_id, project_id, name, type, config_json, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.projects (id, tenant_id, name, code, description, status, priority, owner_tenant_user_id, team_id, start_date, due_date, completed_at, progress_percent, color, created_at, updated_at, archived_at) FROM stdin;
fa49202c-9f0f-4525-b86e-f52afd002347	94ecfea0-859e-45da-a1d0-e0f238211a2f	Implanta├º├úo Inicial	IMPL-001	Projeto de implanta├º├úo inicial do sistema	ACTIVE	HIGH	ea876fef-3d51-4a83-89c5-6506d9a19d58	\N	\N	\N	\N	0	\N	2026-08-16 22:21:54.679	2026-08-16 22:21:54.679	\N
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.refresh_tokens (id, user_id, tenant_id, token_hash, family, is_revoked, replaced_by_id, user_agent, ip_address, expires_at, created_at, updated_at) FROM stdin;
0d1c0141-43d3-4b0e-b722-b068e64cb9ab	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	72d54fe08b1eab7e987bf415d21baddb9ad08fe48c7ba29e1f405f8f13a81441	50d00c45-bd44-40e8-aecc-d50f796e9fb0	t	531ca6ba-717c-487c-af75-3f555a05bc11	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 12:08:01.546	2026-08-18 12:08:01.547	2026-08-18 12:10:35.103
a07e50b8-de5d-4e2b-b543-6db12f5c2c81	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	c5955032d433bfa95337a427cf68d371b18828ec646900283a8200a0a98780dc	0364eb2c-9045-4237-a7a1-07a0b08a29d5	t	62957dd8-844a-4c0b-bdd9-ea99b5642604	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 12:42:11.661	2026-08-18 12:42:11.663	2026-08-18 12:42:16.101
11aeb31d-50e8-4d15-bb03-af72cb9cff43	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	8f1e9e4064b5dc3c88221ba0943d69d7fa000a01fedde2a98d1269f9d519a503	50d00c45-bd44-40e8-aecc-d50f796e9fb0	t	2bb79bed-bf9b-41ac-bb84-c037d7ac13fb	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 13:18:49.069	2026-08-18 13:18:49.07	2026-08-18 13:18:55.916
df2e064e-56cb-4711-9f34-30ff49122dc4	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	79496fa9751684955cd6a9954a8b92c3bbd4191d07ac2ab4f2e8e9ea11acfb81	53684489-85da-4244-8b85-42957fa8a0b1	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 22:37:34.214	2026-08-16 22:37:34.215	2026-08-16 22:37:39.585
b1a017d2-df7d-43ba-bad6-2e32811abb55	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	5da4b35efd83657ea4adbe2a067729c66c9cf1646cbea6ffccab7cd5da1a40ce	c3ea89dc-387c-456a-87c0-1a46d5beb5fa	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 22:39:00.873	2026-08-16 22:39:00.875	2026-08-16 22:52:49.18
5cea5aff-6894-49b2-af69-a1de9e4fbd6d	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	4fa45b7b12903b20a0a1df66662ebaf8f66b08c23807cd06cc410cf273b72549	0ccd9545-97b5-4d25-b28e-db7aaca159fa	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 22:52:41.253	2026-08-16 22:52:41.255	2026-08-16 22:52:49.18
f1f2a94a-bd2a-4801-9c46-68c5a480a55d	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	0647a28ccaf30e1128e8ce3e76a9731043fb595bb4c7d273489baa77a328b552	ffa38227-3e43-4480-a5bb-5c1028a3ce2c	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 22:30:13.889	2026-08-16 22:30:13.891	2026-08-17 18:09:04.164
1e5fe90e-729b-4090-8c70-3f4f78ff4627	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	c81fe76d49c0dd7b50585e14ba1aea0d14a889614882303a3ef1a81d694f0413	f276e3af-04de-4515-8991-0aeacfaed74e	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 22:30:20.734	2026-08-16 22:30:20.735	2026-08-17 18:09:04.164
531ca6ba-717c-487c-af75-3f555a05bc11	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	5ac1ee22e088336eb72ec32bcd6cc73b0d39a40bba1ae1a306023e8c941480d6	50d00c45-bd44-40e8-aecc-d50f796e9fb0	t	641d41ce-7591-492d-8645-1e4575c89332	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 12:10:35.096	2026-08-18 12:10:35.097	2026-08-18 12:13:29.459
62957dd8-844a-4c0b-bdd9-ea99b5642604	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	ee37e5d561a84783b15b3b339889cb35aa9fa309c7bc889da1c136488a294295	0364eb2c-9045-4237-a7a1-07a0b08a29d5	f	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 12:42:16.095	2026-08-18 12:42:16.097	2026-08-18 12:42:16.097
498dfe84-9ed2-42fb-8928-09423d41b6ee	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	a9271e0a4509e72ef2f67fbeaeaa81d9d9d2145d843191d6519d26d672b8afe9	50d00c45-bd44-40e8-aecc-d50f796e9fb0	t	e40a3380-7107-46f1-94e2-226c5d764c25	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 12:42:17.09	2026-08-18 12:42:17.091	2026-08-18 13:00:39.274
bdd46856-098d-4f72-92bb-6dc040bad8d5	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	8891b131b2c06bc8951d99621f4c7ec0a4fba1236a8b5d6f0ec44515dcb8c909	ea83741d-9b57-4ea3-b3a5-14c581b68b45	t	8d197098-f55c-452b-8f98-8ea069de937b	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 14:54:29.103	2026-08-17 14:54:29.105	2026-08-17 14:54:35.013
3763018c-fb85-4372-b0bd-2ae5bb1070cd	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	044ce47487f067166dcedd69eb5f6073ea5a719ceac33a131fc0d16fa1ea2c5c	2aaa641e-698a-4e47-8c58-060c2607be8b	t	b88a1b4b-cfc6-43c1-8cb9-7de27fa61493	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 17:19:52.775	2026-08-17 17:19:52.777	2026-08-17 17:19:57.722
9e1a0118-369b-4843-ad91-f52d2d005c43	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	e10440d0af5e83e58c03dc30fb930713b31dfcc343652f25dd7f80dfce8ea871	a03fb73c-4664-4f90-921a-dac06c453ace	t	31579b2b-691e-4622-a13c-32a910e07325	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 17:38:22.035	2026-08-17 17:38:22.037	2026-08-17 17:38:29.072
dbe5ded5-be2c-4ed1-8a90-be02464a3eec	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	d35c87836cb3e63b7bb41bcbc0f9e6208c3d1cecc6ce5b11ab23a9e4d9113958	a03fb73c-4664-4f90-921a-dac06c453ace	t	db30bce6-5f57-4438-9b7e-7573f7593f40	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 18:06:26.896	2026-08-17 18:06:26.898	2026-08-17 18:06:31.014
2cef07bd-0847-4736-a789-65adc5e4f55f	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	6dfbc87255ffe14679fa27af73da2683aa055a7f9d8fc764889a65825c8c2a62	4456d3b2-d52a-48d7-ad5c-d8c956d8d619	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 22:53:25.042	2026-08-16 22:53:25.044	2026-08-17 18:09:04.164
31579b2b-691e-4622-a13c-32a910e07325	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	2ac950119194b0c0b5ecf327b65ef60c975f8b88977d46fe963f5b9cd0ccafe4	a03fb73c-4664-4f90-921a-dac06c453ace	t	dbe5ded5-be2c-4ed1-8a90-be02464a3eec	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 17:38:29.066	2026-08-17 17:38:29.067	2026-08-17 18:06:26.904
cb8fef2b-dff9-4fc2-a2c1-4c4e4f289cd0	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	e301bd511c0b0e0420384207e9980e99729bcc43ac3502a6da79f16c1fc50746	23d01fc9-44dc-41ef-b885-553040ccda97	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 22:31:45.239	2026-08-16 22:31:45.24	2026-08-17 18:09:04.164
16dae5dd-56f6-49e9-a528-721d1e919d51	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	86e25a4fb005292547984e9e7d57d4e49a415f5d52d77b9dcac0882b15c6bf36	ad286ffb-2e0f-4167-805f-ea8f19e65be7	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 22:31:48.325	2026-08-16 22:31:48.326	2026-08-17 18:09:04.164
1c534b17-5713-4a6a-895f-30c5d64840aa	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	9a5fd7f2c9d6349d0c3ac374a2bdf42c0cb602f90577a451c6f446bc3d5055f0	2c84714c-2879-4686-a0a7-154cad358635	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 22:31:50.05	2026-08-16 22:31:50.051	2026-08-17 18:09:04.164
06b26423-cd4c-4aba-8c1b-59c5537eaea9	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	fd1095e6aebe4c3709b79e415a944f04a99e1377758384fbead2f3dfdb788ee4	5e001bef-9522-487e-b280-8f4cf71bdd99	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 22:31:51.389	2026-08-16 22:31:51.39	2026-08-17 18:09:04.164
820d0610-ba60-4e0c-bc4d-6fcaf603a86f	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	5470d17998f2434d58d767e93ac30658c294696be3284f0fd9db19553bea63d3	8df21d71-dc13-4398-9f5c-cb2d90f6bc14	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 22:31:52.673	2026-08-16 22:31:52.674	2026-08-17 18:09:04.164
527dd267-6174-4ba7-9cf0-468e480adf26	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	d47b8487b5f9411148c314514f9bf2dc79dfc8c611ad7ff33ac04aeeba09cd61	24959b0d-55cf-4a2c-a59d-f178c0959738	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 22:31:53.897	2026-08-16 22:31:53.898	2026-08-17 18:09:04.164
06e4d950-6faf-41f8-af94-8a9cb3bcd2d8	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	fa7bf46f34a95be7b39a2aca08281473cbcdc6c2a878fed5d735a069430c7028	ebdb2b06-517d-499a-a530-75e5c1841f06	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 22:31:55.1	2026-08-16 22:31:55.101	2026-08-17 18:09:04.164
ab7c0316-7c0c-44e5-99a2-c854d4181842	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	f27f63b76e3ddd496fddba3d403f9418c78b4eb8799f7aa480909805edf1897a	4a96d9c7-cb75-48b6-b87b-e5cb9953a644	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 22:31:56.405	2026-08-16 22:31:56.406	2026-08-17 18:09:04.164
e3558800-0c87-47e0-b72b-80482511e200	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	b35028513db7011f72ad12f48b6a0a9ffdb8db7c1db5dc0f646babdf7db7ffb4	65af8fbd-8d38-4a89-b961-e23a39ecd73f	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 22:31:57.553	2026-08-16 22:31:57.554	2026-08-17 18:09:04.164
4d3c5f68-4b37-473f-a314-414d9530d985	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	ebc75391a472996bd9abaa5e4098e1239b115f8f9089a8cd4c5478f33346dd26	2ec2b625-6423-4129-8890-f78028963eca	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 22:32:24.117	2026-08-16 22:32:24.118	2026-08-17 18:09:04.164
2c151a3e-7bfa-47e8-a7d0-a86b1af03dc9	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	c74ef4079212bdc95687fd5bdfe5e5ccabfa664ab7032722cfb7cdaf13ee392a	4543bc60-4184-4b64-8ab0-dc67f1cbbfdb	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 22:35:35.717	2026-08-16 22:35:35.719	2026-08-17 18:09:04.164
b0fc7a27-f4c4-4a72-9d9b-2df823709955	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	d8ab98ce8125627925b19098f0aa2c27be5d66a47a19e0a3541bf1eec79a87f1	c74aaef4-deae-4649-9307-ea37a28d0877	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 22:37:00.78	2026-08-16 22:37:00.782	2026-08-17 18:09:04.164
5c231d0a-dc2f-4dc5-8821-5b42187b9900	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	83bdda2779fa63d2167e4d2284c34436036d6dda638ce1e5f78f25845fd3464d	6e0f0db5-6f33-472f-b580-c32b59433004	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 22:37:55.3	2026-08-16 22:37:55.301	2026-08-17 18:09:04.164
43a5c26e-1b90-46e8-97e4-4e568a3ddea4	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	e3b06a0951246d7010f3a5855e730432837f7a26b9fc08e6462dd568bc1cedae	25b2223c-ce50-4aa0-8028-f18c6566bd6d	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 22:53:27.384	2026-08-16 22:53:27.385	2026-08-17 18:09:04.164
48c1f797-3c49-484f-a0c0-49681256c34b	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	546ebc11a3e92cad67816b26e2b9d7cd6200c124b95c6d7ad60724a6285d6d49	8207988e-bb50-4f33-8e45-1fd0bd889555	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 23:08:14.569	2026-08-16 23:08:14.571	2026-08-17 18:09:04.164
4c3d6052-c4da-42ce-8dfd-4809debab36b	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	f797d287bc520058cca43f186e06e6eff275ad70c5af32d75693337ec56ae32b	e77cda25-fca6-4024-b3ba-c9325a270138	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 23:09:36.225	2026-08-16 23:09:36.227	2026-08-17 18:09:04.164
910ea39c-35bd-4765-b452-2b55bd6d069e	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	d7976cc470b813ac2a27e97493e82303226067d5eeb3cf52b1b6eb4e27fed7da	40bf8cb1-42cb-4bca-bc7d-af0fe67f7bad	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 23:09:38.601	2026-08-16 23:09:38.602	2026-08-17 18:09:04.164
de422996-6cd3-42cd-bcef-8ee5b4b3328f	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	b64c4463db09d9140088bec523691650bed0e6fa54fb28ee6fec351055af334e	0b739a26-a97f-41ee-9983-49f8d2aac92d	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-23 23:09:40.063	2026-08-16 23:09:40.064	2026-08-17 18:09:04.164
18833214-ec9a-485c-bfd5-d10d928102bf	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	8c05db554aff78597c5d4d3a2f6e5a55615688dff421497c510c4e5a9060debf	248b6ad7-27e0-4614-aebf-5a32814337c1	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 13:41:31.817	2026-08-17 13:41:31.819	2026-08-17 18:09:04.164
29aab318-85af-4121-b550-0bfe998b0717	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	6f2edd83d4342dcdf13f0d8dc82a64e8b6a9a700bb1ab13785c6fc6bd8e68bde	8ff7d3a6-ff42-42e3-b7e9-47b81324b0bb	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 13:42:41.941	2026-08-17 13:42:41.942	2026-08-17 18:09:04.164
d912ab43-6169-45db-9f7d-10edba1a7fe8	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	da25ea64aca72451d4d45a1f74cfd784afe110239a397012476880a02882db97	0fde1ee1-1124-47e4-b846-15cde37a7a34	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 13:42:48.495	2026-08-17 13:42:48.496	2026-08-17 18:09:04.164
bbc75762-a3a9-4039-96a3-93006cba9ba7	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	929ad3888dc6364ec8f326c5c71141c97b097a31c663156dff67423e1bcc7a97	37286ff4-9b81-44af-9b92-15394e1d895f	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 13:53:18.56	2026-08-17 13:53:18.562	2026-08-17 18:09:04.164
16727f61-74ac-4961-b7ee-b27fd8d61a27	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	a811af3b21d16a150392ccc083afa72dd4c84d32afd4d7582abc061caeeaceb2	744d7e02-050c-4979-9539-2060f8127383	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 13:53:20.848	2026-08-17 13:53:20.85	2026-08-17 18:09:04.164
423123ba-a07f-458f-9ed6-6b3677885a56	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	e88be410ecb0477b19967019384833b604b8aa50c8b81a516d1e0af65262b8a4	a918487d-797b-4952-84d6-df3f5fdebaa8	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 14:54:20.109	2026-08-17 14:54:20.111	2026-08-17 18:09:04.164
8d197098-f55c-452b-8f98-8ea069de937b	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	3b9041376cbfd9454573ff2de8e2d4a79c5d33dc50092f670c535c843861d646	ea83741d-9b57-4ea3-b3a5-14c581b68b45	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 14:54:35.005	2026-08-17 14:54:35.007	2026-08-17 18:09:04.164
bba0cd5a-5a3b-44f5-a190-61beda937b4c	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	1e20d55c093a861cc6913c18e48d84b4b0f3a6be51638b2cd34f08a8fa4006fc	014d3690-709c-4139-b06f-74bf3d1ca597	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 17:19:51.079	2026-08-17 17:19:51.081	2026-08-17 18:09:04.164
b88a1b4b-cfc6-43c1-8cb9-7de27fa61493	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	1ae6e7b9cc3482858a57b5ad2947152cbeb14a7644b91000f175613864a33b47	2aaa641e-698a-4e47-8c58-060c2607be8b	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 17:19:57.717	2026-08-17 17:19:57.719	2026-08-17 18:09:04.164
db30bce6-5f57-4438-9b7e-7573f7593f40	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	e16c8e64604f40999ad50e81165db5de3d90e1bcf38271e3b96e262306d30c85	a03fb73c-4664-4f90-921a-dac06c453ace	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 18:06:31.008	2026-08-17 18:06:31.01	2026-08-17 18:09:04.164
5aceb038-dae4-4135-b159-a5cf1629af67	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	f1e214db376889c7f6743a02781aca480ca6518bb5dce55535adaff38a7c47f9	770a0696-1d85-49cb-b782-f31158a6b5af	t	5319d92b-b2ed-4bc6-88bf-fe635f7c6eed	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 18:09:09.139	2026-08-17 18:09:09.14	2026-08-17 18:09:14.863
5319d92b-b2ed-4bc6-88bf-fe635f7c6eed	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	c815bbe6d6a88d70e915389095480f0a672ff1837e596ad0bc30fe38e7612eff	770a0696-1d85-49cb-b782-f31158a6b5af	t	d54e1730-a9e2-4f66-b0a3-bd73684d73dd	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 18:09:14.859	2026-08-17 18:09:14.86	2026-08-17 18:29:21.587
d54e1730-a9e2-4f66-b0a3-bd73684d73dd	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	cf94cb9e19220fe258a84d8ae98d5cf9aa8acf94a2b0542aaa8e694799df9073	770a0696-1d85-49cb-b782-f31158a6b5af	t	39a35366-1282-49f5-b64a-4269764e9ca5	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 18:29:21.578	2026-08-17 18:29:21.579	2026-08-17 18:29:26.446
39a35366-1282-49f5-b64a-4269764e9ca5	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	f850458cbdc6d1e578b6ea393a2ae5c8ce294bd3b7be7195e7cabd1038f9cdf0	770a0696-1d85-49cb-b782-f31158a6b5af	t	1ea1747e-61bc-4d1b-9ab6-2afefd54a2f2	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 18:29:26.442	2026-08-17 18:29:26.443	2026-08-17 18:35:32.348
1ea1747e-61bc-4d1b-9ab6-2afefd54a2f2	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	36e5f9cd41695023161537e2271cc02467a154888016393c659db07c5a4e3c6f	770a0696-1d85-49cb-b782-f31158a6b5af	t	0b1fed80-93e6-481e-b026-200aa4d13e1e	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 18:35:32.34	2026-08-17 18:35:32.342	2026-08-17 18:35:46.99
0b1fed80-93e6-481e-b026-200aa4d13e1e	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	21cbf075a4c44e8fbca8600b0caaa7d97369ed302b587dd52058745e98e6d944	770a0696-1d85-49cb-b782-f31158a6b5af	t	511196d9-e143-4b08-96e7-ec3d8d977c43	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 18:35:46.986	2026-08-17 18:35:46.988	2026-08-17 19:11:17.532
511196d9-e143-4b08-96e7-ec3d8d977c43	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	acaa429afdf50c13e83524846e7c3c586520fdcd96d025c91d3235b37974e4ac	770a0696-1d85-49cb-b782-f31158a6b5af	t	31d10f27-74df-4c92-9b4c-dfef196bbfc7	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 19:11:17.522	2026-08-17 19:11:17.524	2026-08-17 19:11:22.303
31d10f27-74df-4c92-9b4c-dfef196bbfc7	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	3df589d30cefd1607233f1b9f6d9f1b7cbd41ba6075df2990ca3da2df12bc889	770a0696-1d85-49cb-b782-f31158a6b5af	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 19:11:22.298	2026-08-17 19:11:22.3	2026-08-17 19:11:22.652
2098be0c-86c2-4458-9536-07eacbb9a64a	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	6a8871d36696e5302505023c5066df26140f782b5b5bb92e4ff4a1f7347e8254	f64c05a2-5d93-4962-9617-a0415f328fcb	t	58a60c3f-e771-491f-a9a8-62608213172d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 19:11:34.194	2026-08-17 19:11:34.196	2026-08-17 19:11:39.529
58a60c3f-e771-491f-a9a8-62608213172d	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	4733d4724bc39f9f78d529a9e78759d96cae4343642f373af395e0a3774cb054	f64c05a2-5d93-4962-9617-a0415f328fcb	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 19:11:39.523	2026-08-17 19:11:39.525	2026-08-17 19:11:43.14
1921ef92-d516-4d9e-8f47-cc595dda7faa	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	f9e60e1e60ae1cdfb0ba87ecdbd6693cc9c81eb80c77c9734de8ec07a323dce8	6764e9c7-0cf4-496b-872a-396ae76ea3fe	t	eeef4acb-b9fb-491b-99b4-bb510e193657	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 19:12:21.065	2026-08-17 19:12:21.068	2026-08-17 19:12:26.388
eeef4acb-b9fb-491b-99b4-bb510e193657	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	f6c0c15c244f82d9cb823380ffbb264578312e3941eb27e7dada63c19ec553e8	6764e9c7-0cf4-496b-872a-396ae76ea3fe	t	3a181e38-3189-45e3-acb0-8ad220825ff0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 19:12:26.382	2026-08-17 19:12:26.384	2026-08-17 19:20:38.368
3a181e38-3189-45e3-acb0-8ad220825ff0	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	5f8606e41a5f758e32decfd1bdbdd1152a5df24b460680ec8a6b7a93abe01502	6764e9c7-0cf4-496b-872a-396ae76ea3fe	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 19:20:38.36	2026-08-17 19:20:38.362	2026-08-17 19:20:47.972
70ea9203-b8b1-4b27-8394-8ba4f199ef69	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	8da9b4dbbcc5515edfff3f79c1eae8bb4b190150f2d9cc984fd7b0f45e4a356b	a46f84d5-314f-472a-ad53-bb29e60cc9a9	t	1ef885ab-063c-4817-9251-91ef142f409b	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 19:21:00.017	2026-08-17 19:21:00.019	2026-08-17 19:21:05.352
1ef885ab-063c-4817-9251-91ef142f409b	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	1b9a84ae70874a5f1f61df4ae4e46f8d27efd0e36e34b5563354d72e1f4c4f8f	a46f84d5-314f-472a-ad53-bb29e60cc9a9	t	c4517a6b-6ee6-471a-8062-0d56b4e86e56	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 19:21:05.348	2026-08-17 19:21:05.349	2026-08-17 19:38:13.271
c4517a6b-6ee6-471a-8062-0d56b4e86e56	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	5c946abe68d793ba17ffe8efbe20277f5e597897c904a3f931f321dc369ba45c	a46f84d5-314f-472a-ad53-bb29e60cc9a9	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 19:38:13.265	2026-08-17 19:38:13.267	2026-08-17 19:38:28.11
fb52ba35-9bd7-4b63-a073-f2826316ff2a	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	04672d468a5af8b6972ab9fa0cbd5f3cb08ad07cc253afabedda64acc949eedd	33513774-46c1-4926-ba65-366a349a746f	t	75f5521c-93ef-4501-8633-84b6c5655a8a	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 19:38:48.38	2026-08-17 19:38:48.381	2026-08-17 19:38:53.744
f1554325-3f46-4b8f-8546-77e6055bb148	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	7359732d059424cc358fb9153d86fed27212faf40c63dec491cb8a74d5584093	e1a48f85-c5f3-4ac6-965c-779e0d7db9de	t	\N	curl/8.21.0	127.0.0.1	2026-08-24 19:22:11.134	2026-08-17 19:22:11.135	2026-08-17 19:47:47.319
2dad18a3-bd84-430c-9ac3-902f907f17ac	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	abe5a48913cac1ef2b9ca93673a0927e57a8774e5c100ad2eba301666a84be5b	77356576-f568-4323-9828-c9a1d3c6cb56	t	\N	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; pt-BR) PowerShell/7.6.5	127.0.0.1	2026-08-24 19:34:18.618	2026-08-17 19:34:18.619	2026-08-17 19:47:47.319
af7b8677-debe-49d4-869e-6b515a664e9a	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	0b5fb71958f54913d3c6c0425854a2e9edd790b95ae8837e2310407aa482feaa	20c3e429-10ad-4cb8-b5b1-f46aab1e9569	t	\N	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; pt-BR) PowerShell/7.6.5	127.0.0.1	2026-08-24 19:37:18.787	2026-08-17 19:37:18.789	2026-08-17 19:47:47.319
75f5521c-93ef-4501-8633-84b6c5655a8a	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	d4efbba9a7a80228e1bfb5067df9a78d27310f57b6dc8b5b889a03213581eda4	33513774-46c1-4926-ba65-366a349a746f	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 19:38:53.737	2026-08-17 19:38:53.738	2026-08-17 19:47:47.319
bc406917-886a-4bb8-aba2-2c543f826cf0	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	f2e95f1b18bcc3dee3ac1dad30731d57921635cd828520db1f935c6c18253fa3	5225d86e-b05c-40d8-b203-bc48dbd06a95	t	9785a2e5-bf52-4e52-9a64-ae56ff450021	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 19:47:49.782	2026-08-17 19:47:49.783	2026-08-17 19:47:55.887
9785a2e5-bf52-4e52-9a64-ae56ff450021	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	a97e60b9f42bf313f5d76b965436595333b98420fd37b9a77a7cc312460c376c	5225d86e-b05c-40d8-b203-bc48dbd06a95	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 19:47:55.882	2026-08-17 19:47:55.883	2026-08-17 20:02:29.867
641d41ce-7591-492d-8645-1e4575c89332	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	dd8d9f50ee109ee5577b759226865a2817b6a957973eb84e43c09dc5a22601df	50d00c45-bd44-40e8-aecc-d50f796e9fb0	t	5b72379e-d7fb-4c8d-bf0b-539d621ab5e6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 12:13:29.449	2026-08-18 12:13:29.451	2026-08-18 12:24:35.102
aeb89968-a6c5-4105-b164-a243277018b8	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	f793c32214196c15db56403e6fd01a42b829ffd47e7333396c9a75498cd4f6d6	49ef75dd-22b6-4839-a84d-bc53a4fee22e	t	c7c17daf-0485-4657-9ed1-22d6447d119c	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 20:02:48.985	2026-08-17 20:02:48.987	2026-08-18 12:07:37.227
e40a3380-7107-46f1-94e2-226c5d764c25	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	d33c97088820b2204a04bdf4a38853e90380beb6259051dcc2f5c0743f6eb043	50d00c45-bd44-40e8-aecc-d50f796e9fb0	t	a0d4955f-820d-4c58-885f-e9dbd26e79c3	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 13:00:39.265	2026-08-18 13:00:39.267	2026-08-18 13:00:43.872
5b72379e-d7fb-4c8d-bf0b-539d621ab5e6	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	9c8f7fbaae5c6ac42e07415d80e30079f8a16a6bc2252e3fec05aa9eeaf81c1e	50d00c45-bd44-40e8-aecc-d50f796e9fb0	t	fc83d48c-2d89-40ab-baec-af727d4d7b7b	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 12:24:35.094	2026-08-18 12:24:35.095	2026-08-18 12:28:33.243
fc83d48c-2d89-40ab-baec-af727d4d7b7b	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	b3b0195769ba7f56d5fdaf944defc7d1a84f7f963a62be3eb5a3cacfd3c3fb15	50d00c45-bd44-40e8-aecc-d50f796e9fb0	t	3b388b7f-78dc-4d15-a9dc-6a81ac4a7437	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 12:28:33.236	2026-08-18 12:28:33.237	2026-08-18 12:32:43.353
6f587ccc-7beb-4a98-b58a-f3e8329fb68a	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	90db910c05357c1aa21da72dd56129136f3ba0dc5351870c1c51bef425ae0616	0364eb2c-9045-4237-a7a1-07a0b08a29d5	t	a07e50b8-de5d-4e2b-b543-6db12f5c2c81	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 12:05:57.095	2026-08-18 12:05:57.096	2026-08-18 12:42:11.671
a0d4955f-820d-4c58-885f-e9dbd26e79c3	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	a1a746e47fe4d5bca2d184469d4566940e3f79f0018930563e63ff881f595f46	50d00c45-bd44-40e8-aecc-d50f796e9fb0	t	ee60d8d8-3fe7-4093-a566-f4d9989d65c1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 13:00:43.866	2026-08-18 13:00:43.867	2026-08-18 13:01:16.782
ccb20437-c9da-40e8-86ee-36d574d8567b	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	cd760e429eb9be935faf12504c7e4b5010cf21a78c2c6550abdf4b73d5b6503f	f811fbba-7d1b-496e-9c2e-550cc0b6b545	t	31015803-b8ea-41db-9690-10a38d4b2b49	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 11:50:37.763	2026-08-18 11:50:37.764	2026-08-18 11:50:43.127
31015803-b8ea-41db-9690-10a38d4b2b49	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	2020246db292f7f72b2ba68f8d131e154de06d91f10ea742d67b2f96ba1f8a65	f811fbba-7d1b-496e-9c2e-550cc0b6b545	t	5ba62364-1da0-481a-b7d5-c0090a732de0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 11:50:43.121	2026-08-18 11:50:43.122	2026-08-18 12:00:31.114
5ba62364-1da0-481a-b7d5-c0090a732de0	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	e482de5143964678f0bc6ad9a89ebaf7f1ffba7464181fa52f4c01c42accf383	f811fbba-7d1b-496e-9c2e-550cc0b6b545	t	78622ba0-d4d2-41e4-8050-6d0b71ea7f79	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 12:00:31.106	2026-08-18 12:00:31.108	2026-08-18 12:03:25.646
78622ba0-d4d2-41e4-8050-6d0b71ea7f79	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	41c63890df7eb248c28e66104d143c7a912dcbbdd5d0f124a953744e3ce4f0ee	f811fbba-7d1b-496e-9c2e-550cc0b6b545	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 12:03:25.639	2026-08-18 12:03:25.64	2026-08-18 12:04:34.412
66c579d1-bec1-44b9-bce9-cd100821e059	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	811a39c6d18ea2bcd625b9cd4db106249309e6e3043d39ce8bb2471786a5086c	c2217485-f061-43ca-a0c8-acac91c26a03	t	2ec56aaa-6d6b-4f59-95a3-5ff771ca102d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 12:04:44.952	2026-08-18 12:04:44.954	2026-08-18 12:04:50.306
2ec56aaa-6d6b-4f59-95a3-5ff771ca102d	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	1d3a0815fb26504b5c9560617e3061a35acb44f3cc317f17c871f06be021df4d	c2217485-f061-43ca-a0c8-acac91c26a03	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 12:04:50.3	2026-08-18 12:04:50.302	2026-08-18 12:04:53.786
4586b875-4190-44de-a2b2-a91b586ab0a3	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	592ffa6bd92dca8c89f9bb454abfa9b5d5dd8f250b2cb15df210c2eed22f14a7	33a97be2-b60e-460c-9327-db6eee71264a	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 12:05:18.214	2026-08-18 12:05:18.217	2026-08-18 12:05:41.85
eeaed3bc-4e4d-40ac-83c0-6746b22200af	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	7161890fa721e38c6bd405c4c80e14fa1f3854d2b81c30775cbc54509965bbc9	33a97be2-b60e-460c-9327-db6eee71264a	t	4586b875-4190-44de-a2b2-a91b586ab0a3	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 12:05:12.891	2026-08-18 12:05:12.893	2026-08-18 12:05:18.22
9d8a6e58-c774-4930-ae1a-b872528855b3	344d2691-47b1-4550-9395-f4fb69ec46b7	94ecfea0-859e-45da-a1d0-e0f238211a2f	4cf022bf9aec4d3d12d2820d183164f507b019e45b36f02ce0cfe53dbdb106b6	0364eb2c-9045-4237-a7a1-07a0b08a29d5	t	6f587ccc-7beb-4a98-b58a-f3e8329fb68a	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 12:05:51.835	2026-08-18 12:05:51.836	2026-08-18 12:05:57.099
3b388b7f-78dc-4d15-a9dc-6a81ac4a7437	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	3de120eac2db29f7fb8b0cd67283f3b8d8178192b6ac3cc7599078b593c56363	50d00c45-bd44-40e8-aecc-d50f796e9fb0	t	b2c3008c-b702-44ef-b53f-7551473a40db	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 12:32:43.346	2026-08-18 12:32:43.348	2026-08-18 12:33:46
ee60d8d8-3fe7-4093-a566-f4d9989d65c1	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	2e39f2efd9142670867a79ddfd03843796ae3bd2a8eeff00c2581d8702c5c181	50d00c45-bd44-40e8-aecc-d50f796e9fb0	t	b1818ea8-323b-4fa5-a2a9-59505f9b47f9	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 13:01:16.777	2026-08-18 13:01:16.778	2026-08-18 13:13:21.246
c7c17daf-0485-4657-9ed1-22d6447d119c	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	ddb8abe5aeac489f6535501e5d14dbd0bcbe3a954e6049eaf55440350c2e66a7	49ef75dd-22b6-4839-a84d-bc53a4fee22e	t	7759c64d-89a2-46f7-aed3-1ba6e3934840	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 20:02:55.636	2026-08-17 20:02:55.638	2026-08-18 12:07:37.227
d4332805-e050-4f6e-85fb-3491f7156942	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	7e59e2279831ecc463835853d2751bbcd0e281d66d6b767398809130c1801bad	49ef75dd-22b6-4839-a84d-bc53a4fee22e	t	064cdb0e-cf96-406d-bc52-e60be76f606f	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 10:26:14.41	2026-08-18 10:26:14.412	2026-08-18 12:07:37.227
064cdb0e-cf96-406d-bc52-e60be76f606f	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	7ad4adcbf045f67fceaf0989a83eb0c853418754f2f5d36ab4d68d083eafea7a	49ef75dd-22b6-4839-a84d-bc53a4fee22e	t	ad5c44d2-0b53-4fd5-8a94-144205534730	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 10:48:50.569	2026-08-18 10:48:50.571	2026-08-18 12:07:37.227
ad5c44d2-0b53-4fd5-8a94-144205534730	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	4f5e905b0bffcea2080bd3e1d5a81562d33e3dc52486eee902ed9834f2313a87	49ef75dd-22b6-4839-a84d-bc53a4fee22e	t	d9704841-ee83-4fe9-b1f0-ef0e96e252a9	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 11:06:35.49	2026-08-18 11:06:35.492	2026-08-18 12:07:37.227
d9704841-ee83-4fe9-b1f0-ef0e96e252a9	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	e86e2778ef529da167506540cfa56dc164ada54af4ca1c96d3c0209c1dc1ffe9	49ef75dd-22b6-4839-a84d-bc53a4fee22e	t	a5b5ef79-03f6-4870-a829-2cbe79b33f3d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 11:21:10.586	2026-08-18 11:21:10.588	2026-08-18 12:07:37.227
a5b5ef79-03f6-4870-a829-2cbe79b33f3d	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	ee08b613e0d44ecaa860630a40554d0289c1a4e773ad2676cd59a77ca048370b	49ef75dd-22b6-4839-a84d-bc53a4fee22e	t	ad51c43a-9f42-461a-b831-ed4a82d6f147	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 11:27:49.095	2026-08-18 11:27:49.097	2026-08-18 12:07:37.227
ad51c43a-9f42-461a-b831-ed4a82d6f147	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	4f63dbddd47428af1d9158844156e72bae984158187a436e067b2c8724538602	49ef75dd-22b6-4839-a84d-bc53a4fee22e	t	90fb0ceb-d142-44a5-afef-ef43b988423e	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 11:28:01.378	2026-08-18 11:28:01.38	2026-08-18 12:07:37.227
90fb0ceb-d142-44a5-afef-ef43b988423e	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	fbe82f81def5d511240ea7b559a5f677b9d7c9797a87ed7507064c7189394a66	49ef75dd-22b6-4839-a84d-bc53a4fee22e	t	952886d8-d60f-4e40-9504-8c7cb8d351aa	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 11:43:16.308	2026-08-18 11:43:16.31	2026-08-18 12:07:37.227
952886d8-d60f-4e40-9504-8c7cb8d351aa	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	f34e4447cae760fc3025cdd72cf5adebca374e3b8c15cc98609c65b82d1e4a7b	49ef75dd-22b6-4839-a84d-bc53a4fee22e	t	e48a09d2-6d57-4a84-9b37-ab70f241c220	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 11:43:20.717	2026-08-18 11:43:20.719	2026-08-18 12:07:37.227
e48a09d2-6d57-4a84-9b37-ab70f241c220	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	f73ca4a62b7351501d35d5bbd579816b95c9537857b6d4c5eb65988bea116d35	49ef75dd-22b6-4839-a84d-bc53a4fee22e	t	bbe21854-5d89-43a0-8c9c-3ab28ed3dd75	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 11:48:47.647	2026-08-18 11:48:47.649	2026-08-18 12:07:37.227
b2c3008c-b702-44ef-b53f-7551473a40db	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	41d73af64626c7e31a9aa5fb6678f813c363af7bb70f0e9c02738c85a19ee1b4	50d00c45-bd44-40e8-aecc-d50f796e9fb0	t	eeda9470-6d55-45f5-a6c5-aba9f29b9975	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 12:33:45.992	2026-08-18 12:33:45.993	2026-08-18 12:36:52.551
b1818ea8-323b-4fa5-a2a9-59505f9b47f9	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	cccb57caa8a0441f4de8b597986534c3d5f44fb59452527321788fb038652211	50d00c45-bd44-40e8-aecc-d50f796e9fb0	t	291a240e-e313-4c44-830b-1a83bcb76dca	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 13:13:21.238	2026-08-18 13:13:21.24	2026-08-18 13:18:39.333
e37e7e2a-0593-4891-a6fd-b20c9e237b96	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	35adbd6733a5523fc1bf2e24b09bffa9f49174d1fa6d36e91b30a2aca769f7b4	50d00c45-bd44-40e8-aecc-d50f796e9fb0	t	0d1c0141-43d3-4b0e-b722-b068e64cb9ab	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 12:07:56.182	2026-08-18 12:07:56.183	2026-08-18 12:08:01.552
eeda9470-6d55-45f5-a6c5-aba9f29b9975	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	f669c6568a7005628d0c600bd49ee20a0fb5a276c6db424ec4f367e57cee6ba5	50d00c45-bd44-40e8-aecc-d50f796e9fb0	t	498dfe84-9ed2-42fb-8928-09423d41b6ee	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 12:36:52.541	2026-08-18 12:36:52.542	2026-08-18 12:42:17.094
291a240e-e313-4c44-830b-1a83bcb76dca	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	a488e0650e6a0077e78bd3c552cf079a3fcb3ac76a105299ddcb912b409f0fd7	50d00c45-bd44-40e8-aecc-d50f796e9fb0	t	11aeb31d-50e8-4d15-bb03-af72cb9cff43	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 13:18:39.326	2026-08-18 13:18:39.327	2026-08-18 13:18:49.075
2bb79bed-bf9b-41ac-bb84-c037d7ac13fb	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	7e5eb22418450fa490e4bfbe466d9a66f54eb0e2010eefadb7d1f89b4d58d824	50d00c45-bd44-40e8-aecc-d50f796e9fb0	f	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 13:18:55.911	2026-08-18 13:18:55.912	2026-08-18 13:18:55.912
bbe21854-5d89-43a0-8c9c-3ab28ed3dd75	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	c089b8a440d9096009560e0a577872ad606500fcbd9334323a33fc5819bb1490	49ef75dd-22b6-4839-a84d-bc53a4fee22e	t	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 11:49:33.093	2026-08-18 11:49:33.094	2026-08-18 12:07:37.227
7759c64d-89a2-46f7-aed3-1ba6e3934840	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	a8445d398d9f36bc448e2c49c32f1bbc023ae9752a7afadd86901757bfb975aa	49ef75dd-22b6-4839-a84d-bc53a4fee22e	t	56dd7f48-31a0-4eda-b933-8e0cccbf538c	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-24 20:15:36.882	2026-08-17 20:15:36.884	2026-08-18 12:07:37.227
56dd7f48-31a0-4eda-b933-8e0cccbf538c	8b4ce856-138c-4b1d-b609-23c565929df8	94ecfea0-859e-45da-a1d0-e0f238211a2f	06d864e5c182b4894a00cf83fdd4e02d32e2784abc61e13bd15a7b487f4fe942	49ef75dd-22b6-4839-a84d-bc53a4fee22e	t	d4332805-e050-4f6e-85fb-3491f7156942	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	127.0.0.1	2026-08-25 10:22:38.472	2026-08-18 10:22:38.474	2026-08-18 12:07:37.227
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role_permissions (id, role_id, permission_id) FROM stdin;
329a9272-fec4-4845-8d6e-64cbcba4235a	admin	fc479433-f0a3-43b9-97a9-bacafe2155cb
0bd78b88-511d-4140-8172-6135377a9c0d	admin	f939a4c7-6b82-4c03-b801-4038e8c965f2
630564b0-a5c1-42d6-bf0b-817aa21cef8c	admin	285237b4-a1e8-4b6c-8afb-8aa2b2fb6dcc
5597e40e-7a58-491b-bbb7-910ac736ed7c	admin	832af678-767f-411a-a2ad-27142d3cc634
7a763c9c-c561-49a6-87fe-0fdb9498c5b4	admin	5f40dad5-446b-4513-8276-eb9856b79765
051b3d35-70d6-4bf4-8bc2-93fb056e1974	admin	be19f16f-894e-4cd9-b6ff-f366820ace8f
cfe2dc59-3792-494c-bb99-cf962cda5a53	admin	65288b42-9876-459c-97e7-b87afc903915
bc8ec5b1-c718-4173-9a6c-e8674d1be026	admin	bfd98f23-49ed-4b68-b5ef-2b2e402584ad
a81f877c-109b-4588-a0c7-b7e6ff1ba8f2	admin	5be906a3-989f-4d38-82ff-d5e7b683ad83
28b477cf-ac4e-4dd6-9560-4c083e8aa765	admin	dce3122c-e11e-4bf3-a971-6cdf18252da2
61ab8b6c-3ae1-4e9e-af10-6a6c4d2e69bd	admin	456c5421-2841-4552-a481-a40a12f1fad3
0a8efd4b-561f-450f-9c43-21042285752b	admin	32376878-d90e-4994-9250-9bf10b7f37bc
89156433-b912-4224-8bc6-48efc6e6fe53	admin	87d1b2a2-9559-4c41-8a4f-3093ae7045c1
0c7d669f-050a-428d-afe2-35365b9754b0	admin	0a64734f-8b22-4b7b-83ef-08e9feeb8cb3
876ea4ca-d834-4ec0-9921-e91411610383	admin	00d114a0-9b40-473a-9ee7-6ea8e920259c
d370cea9-6bb2-46d6-8a72-b4eebc4fb12c	admin	53eecae5-af39-4a97-9339-a21d04e48b67
8220213a-c517-419d-8350-691af35bacde	admin	db1e2bfb-470d-4ed2-b4b3-eade1ca2b590
cf4522c7-9ef1-4640-ad15-451a6174c1a5	admin	ca3cddbb-193b-4ce8-8841-8227003ad4e6
57d59fdc-dd8f-4caf-a6e8-d9bc1ddc87a7	admin	4af38e99-0c50-4964-8a30-d0889aac66fc
07f3da89-0144-47a0-b4e2-d809cde7e09d	admin	9fe87311-0099-42da-ae34-01f8264a5e14
c3cccfd1-d6c0-4bfe-bce7-5407782a94df	admin	feba9588-dd73-42db-a059-efe3d819246e
5a8a1c13-cb52-4699-9b79-e156032a30ab	admin	fa03d71a-c030-495f-a2d8-8c0441282f14
0ff6afc2-ccc2-47fe-ad1f-44f972587f61	admin	6471306e-d3b2-4e2d-a86e-7064af154f65
59ace80e-d0df-4328-b356-58179d7c048f	admin	da0eb437-f7df-496b-8425-5f978598aca1
24558a56-530f-4d12-bf09-51c29581b818	admin	f1c654d6-868c-414b-b5f3-04414f62a907
306b51f6-fe0b-48b4-b0a6-afd8aa12d946	admin	05890853-0a20-48cf-90c7-794e9ae53bc0
8e9e1137-cc94-4e2c-80ee-4ba01a053d2b	admin	0144d39f-d7e3-49bf-9029-4841035e9be6
1a66ec08-2ee2-42bf-b419-446920edfffc	admin	783f362a-c0e5-49fa-9231-8462743d7fa0
11ad99c0-8066-49f9-9299-d2f82b51f100	admin	3a075d4b-1a9c-4ad6-af9c-2f6ef137a77d
b859668c-8d96-4cbe-9a42-f53c453c88d8	admin	bc41f972-fb09-4425-a45a-23bfc17a64df
d9a9c8a8-f8ec-4c2f-924c-cdad2ef0c83d	admin	b089bb60-62dd-4fac-8a31-8e017914b6a9
3eaf6264-6562-4a37-b826-c743aea1fa17	admin	2042972a-d6a3-4288-963d-f40ce1974b59
9a6328db-c200-4052-a4e4-a01ba7bf6fb3	admin	b3d195ca-147d-4a7c-bd48-a794d0b22eb1
69d02406-43cf-46ff-af52-3fa8d4c31434	admin	8b45bb0d-5edc-4355-a3c2-60603a50fc20
7a5e2ace-bd50-430f-9a3a-5eef61983850	admin	a9360adc-0594-40e5-8e55-f33727ac75b2
7a55ed47-4d01-412b-8248-cfd7910d6c44	admin	cfabe2a9-122f-4bf4-a415-4c3525728390
f968412d-de31-45e3-8c18-637229b13097	admin	2536a362-925f-4231-801c-d8e9c18776aa
62f08c54-386a-4718-8d7e-d955eb2381a5	admin	6ffce1f7-8cfd-44a3-b580-9bce2edde659
5027b456-4f1a-4ad7-9c11-e71f61b1f3c2	admin	5ed5d449-2987-451c-96f5-a9501da20448
2a3f1370-9ca4-4e2c-a02f-d35d77c7ec77	admin	6236dc8b-5cff-4805-affc-dddcf4cafc9c
334a884e-3e9d-4ccc-98d3-aa5d16172a75	admin	7a52c070-ab0f-4ec4-a349-c36773e74a9a
2c141028-7ee2-4be2-ae5a-753210e086d8	admin	5e15ba4f-72b9-446c-9464-52f69685b3eb
b536ef4c-fa4c-478c-be58-7015671ebf0d	admin	ccfdcc7f-2402-4560-bf7e-2045784d637a
b4717d4d-b967-43fa-9305-dd3170d8ecec	admin	313a46d2-6b1d-4134-89a5-3d4c9a93ba57
21bcf139-8286-42d8-b754-2d5924d7e85f	admin	bdf198ea-8154-4997-946f-4f7f76d6f7cd
4590f38f-9337-458b-9b38-ec2752bbfa4c	admin	4b99adad-5220-4e05-982e-ac5256ddcfcd
1c4a449e-1aec-4893-a196-f78dc8eeffbe	admin	2fd70013-7fb6-4460-a97a-d1c72e90795c
5ff25e28-49fb-4931-bf93-94e1ac8d33b9	admin	76763a4c-6d88-4d66-b707-c336acb553a4
9b628dce-d41c-41d1-898a-cd2af0e7a2fd	admin	f0a0bba0-a1e1-4080-a6de-164540a36649
4e2ff65d-3ec4-420d-9f55-86f14c9e4f71	admin	cc653ab1-89f9-403c-82a5-c9a9753afdc3
9a1d7694-9097-4e12-8793-556b9ca9cc44	admin	0c195cc0-78f4-4b18-89ff-7340b8de75e7
b8bb1920-bb57-453b-a7cf-b209a2b5bd74	admin	f3d21e56-c790-4849-84d7-c8d6457aeb51
b8b20115-f174-4fee-8107-46990781de3c	admin	97574dd3-384f-48fb-8d2c-a2335925da01
8f513f79-f60d-4f41-9f1f-132e33b18ca3	admin	1d0a31a7-2519-44dd-8798-bf3d94fffa29
2e92c67d-3c46-441a-aca5-166f39cefc77	admin	554e3d81-ba2b-424f-94ce-4c61b04e9aa9
c55aa0a1-0ecd-442a-83e8-0bbcdf0638ea	admin	21d91aef-5f63-4c5a-ba45-4a736f263ba6
f2e1a387-d8fe-4ef1-a204-7c81fe0db796	admin	e08cc8ee-fcc8-4bd0-b97a-2f1415665762
78726558-89de-41a8-803d-6beb87b04bdc	admin	670913f8-8091-43f4-b881-8f83b5c7c025
5da50065-c653-4bfe-a086-9df7b575c848	admin	cc151a9f-e9f8-434c-bacc-889da36384e2
216539a8-3dfc-4ce2-996d-b204664ce38c	admin	546b4d39-4ccb-4795-b915-7e4884849148
a710fcfd-2f7c-400b-9ef1-6d6f772da1fa	admin	a323fecd-c980-453f-b12e-3a1acb1d40ab
13fd82c6-6327-4c7e-8f97-2f858adfcc7d	gestor	832af678-767f-411a-a2ad-27142d3cc634
368a3e92-ba94-4633-bd2d-c38dda0eb880	gestor	5f40dad5-446b-4513-8276-eb9856b79765
219e41ea-022d-43f6-b01f-9eb59dbdfea5	gestor	87d1b2a2-9559-4c41-8a4f-3093ae7045c1
5480a8a1-7ce2-42a9-b93b-1f5596973cd2	gestor	0a64734f-8b22-4b7b-83ef-08e9feeb8cb3
e2c8eab3-ca05-4a46-bb7f-bc857b47cfb3	gestor	00d114a0-9b40-473a-9ee7-6ea8e920259c
da05c26e-d959-47f2-852d-02c87ff44cdf	gestor	db1e2bfb-470d-4ed2-b4b3-eade1ca2b590
23546e33-51ee-4d7a-82dd-4cb5ed5b713a	gestor	ca3cddbb-193b-4ce8-8841-8227003ad4e6
19c9664d-6bb0-4a0b-9f95-b53b4614d64b	gestor	4af38e99-0c50-4964-8a30-d0889aac66fc
ffefe666-4cdf-43a4-9a5b-2faa56658cf6	gestor	9fe87311-0099-42da-ae34-01f8264a5e14
425b0ea7-1d90-48d9-b12a-492b7d55907b	gestor	feba9588-dd73-42db-a059-efe3d819246e
186f89a0-101c-488e-8cb8-969edd550655	gestor	6471306e-d3b2-4e2d-a86e-7064af154f65
3c893d80-bbac-4ca7-a4a1-a33002ff3155	gestor	da0eb437-f7df-496b-8425-5f978598aca1
ae2f8b08-a7b2-4444-8df7-0c19f2c4a094	gestor	f1c654d6-868c-414b-b5f3-04414f62a907
36f72658-1bd9-4797-93d7-f7df2f35ba14	gestor	05890853-0a20-48cf-90c7-794e9ae53bc0
e0ef8473-5de6-4533-8a05-4ea7abf26ae0	gestor	0144d39f-d7e3-49bf-9029-4841035e9be6
df08ec7a-0da0-4e9d-9950-d86a8c33a6d6	gestor	3a075d4b-1a9c-4ad6-af9c-2f6ef137a77d
bd08a1b9-5d81-4e94-9c56-2071964e097d	gestor	bc41f972-fb09-4425-a45a-23bfc17a64df
952223d4-7c9e-4738-bfea-287be41df26f	gestor	b089bb60-62dd-4fac-8a31-8e017914b6a9
b7228a6c-a0c4-4690-b9af-b3bcd2cdb35c	gestor	2042972a-d6a3-4288-963d-f40ce1974b59
89e8a469-a498-4755-983c-99a23e73d736	gestor	b3d195ca-147d-4a7c-bd48-a794d0b22eb1
f95dad2d-c8fc-4da7-832d-46474bc45b09	gestor	8b45bb0d-5edc-4355-a3c2-60603a50fc20
9cf8a902-00da-45bd-91f8-4cb1d6f1fd03	gestor	a9360adc-0594-40e5-8e55-f33727ac75b2
2a89714e-0063-40ff-a77e-6b0d60481dbc	gestor	cfabe2a9-122f-4bf4-a415-4c3525728390
5fd3159f-4a63-4751-9d08-4aa5dbc54437	gestor	2536a362-925f-4231-801c-d8e9c18776aa
580c2889-9b0c-47de-b0b2-01230499af49	gestor	6ffce1f7-8cfd-44a3-b580-9bce2edde659
eb831642-5223-4ad3-ae8d-ffae85e8dcb2	gestor	6236dc8b-5cff-4805-affc-dddcf4cafc9c
a24f920f-2005-4033-8746-a261ce03471c	gestor	7a52c070-ab0f-4ec4-a349-c36773e74a9a
20f76218-5d21-4960-a6ce-a03b8929318c	gestor	5e15ba4f-72b9-446c-9464-52f69685b3eb
b1792fe3-827c-43a0-98a5-44608a45c8a0	gestor	313a46d2-6b1d-4134-89a5-3d4c9a93ba57
58f54567-2949-4835-b143-c4c893d791d5	gestor	bdf198ea-8154-4997-946f-4f7f76d6f7cd
0615b4f6-cf02-41f2-ab95-02564e2e8de6	gestor	4b99adad-5220-4e05-982e-ac5256ddcfcd
ee612241-b2d7-4f9f-8cfb-f7a7b620afa6	gestor	cc151a9f-e9f8-434c-bacc-889da36384e2
0074df9c-8de0-4053-a3a7-47f408c89fd3	gestor	546b4d39-4ccb-4795-b915-7e4884849148
d6e9e845-a37a-4f48-a6cf-02bd1c066dc1	gestor	a323fecd-c980-453f-b12e-3a1acb1d40ab
2ac23da4-2c8b-44d9-a4da-6e862e439c7d	colaborador	832af678-767f-411a-a2ad-27142d3cc634
979575f1-4be7-465d-b58f-5f318f74a9f3	colaborador	ca3cddbb-193b-4ce8-8841-8227003ad4e6
fd812406-5bb9-485c-81e1-9bad5d56a169	colaborador	f1c654d6-868c-414b-b5f3-04414f62a907
f404e816-42aa-488a-b1b7-48ac1577f904	colaborador	05890853-0a20-48cf-90c7-794e9ae53bc0
cf5ce58a-a2a7-489b-bd07-27d95a7a471c	colaborador	0144d39f-d7e3-49bf-9029-4841035e9be6
21bcb775-f83a-4d76-8bb2-c269c36da52f	colaborador	3a075d4b-1a9c-4ad6-af9c-2f6ef137a77d
a229f0d1-82a1-4357-a8ed-bad388f4f9cd	colaborador	b089bb60-62dd-4fac-8a31-8e017914b6a9
1bc9ec88-6b8e-425a-935e-bce70f53c0a7	colaborador	2042972a-d6a3-4288-963d-f40ce1974b59
750339d6-bfaf-4ea0-9493-2ffd7398710b	colaborador	b3d195ca-147d-4a7c-bd48-a794d0b22eb1
fca47924-fa30-457b-9311-0b5c8552e442	colaborador	8b45bb0d-5edc-4355-a3c2-60603a50fc20
76e9632d-77cd-45bc-877f-445f4af848d1	colaborador	cfabe2a9-122f-4bf4-a415-4c3525728390
37c046e8-6d25-44b2-b484-4ff6f944fe80	colaborador	6236dc8b-5cff-4805-affc-dddcf4cafc9c
4949a434-a29a-4bc6-ad9a-6318a8a2e126	colaborador	4b99adad-5220-4e05-982e-ac5256ddcfcd
b40c6468-db4e-476a-bdfe-51055d64a60e	colaborador	cc151a9f-e9f8-434c-bacc-889da36384e2
3892afbe-e7c2-46a0-bbb3-d60b3be2ee49	colaborador	a323fecd-c980-453f-b12e-3a1acb1d40ab
53b6c374-42a4-4f2b-8c4e-41ffa9c22118	convidado	832af678-767f-411a-a2ad-27142d3cc634
7e2008f7-d2bd-44ce-88be-676bd2d872e7	convidado	ca3cddbb-193b-4ce8-8841-8227003ad4e6
9872de86-8855-4b1c-9b8d-7a8811b4be32	convidado	f1c654d6-868c-414b-b5f3-04414f62a907
c85e58d5-773e-4c09-a8e1-648c9bd9d4cc	convidado	cfabe2a9-122f-4bf4-a415-4c3525728390
70bb04ee-57a9-4f31-900b-5b2e8aca5505	convidado	6236dc8b-5cff-4805-affc-dddcf4cafc9c
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, tenant_id, name, description, is_system_role, created_at, updated_at) FROM stdin;
admin	\N	admin	Controle total do tenant.	t	2026-08-16 22:21:54.237	2026-08-16 22:22:25.512
gestor	\N	gestor	Gerencia projetos, equipes e tarefas.	t	2026-08-16 22:21:54.24	2026-08-16 22:22:25.515
colaborador	\N	colaborador	Executa tarefas, comenta, atualiza status.	t	2026-08-16 22:21:54.242	2026-08-16 22:22:25.516
convidado	\N	convidado	Acesso restrito de leitura.	t	2026-08-16 22:21:54.244	2026-08-16 22:22:25.518
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscriptions (id, tenant_id, plan_id, status, started_at, expires_at, trial_ends_at, cancelled_at, created_at, updated_at) FROM stdin;
caab5663-6478-4f2c-9b03-3efb6e86ae7a	94ecfea0-859e-45da-a1d0-e0f238211a2f	trial	TRIALING	2026-08-16 22:21:54.14	\N	2026-09-15 22:21:54.139	\N	2026-08-16 22:21:54.142	2026-08-16 22:21:54.142
\.


--
-- Data for Name: task_assignees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_assignees (id, tenant_id, task_id, tenant_user_id, assigned_at) FROM stdin;
\.


--
-- Data for Name: task_checklist_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_checklist_items (id, tenant_id, checklist_id, content, is_done, done_by_tenant_user_id, done_at, "position", created_at) FROM stdin;
\.


--
-- Data for Name: task_checklists; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_checklists (id, tenant_id, task_id, title, "position", created_at) FROM stdin;
\.


--
-- Data for Name: task_comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_comments (id, tenant_id, task_id, author_tenant_user_id, content, created_at, updated_at, deleted_at) FROM stdin;
ed4d98db-11b7-4efb-910a-a1b5951dd9bf	94ecfea0-859e-45da-a1d0-e0f238211a2f	cdd21cfe-6d5e-491b-80a9-f8116e4fac68	ea876fef-3d51-4a83-89c5-6506d9a19d58	teste01	2026-08-18 11:51:33.444	2026-08-18 11:51:33.444	\N
364fcd3a-8fd4-448c-907e-3c4641e3d59e	94ecfea0-859e-45da-a1d0-e0f238211a2f	cdd21cfe-6d5e-491b-80a9-f8116e4fac68	ea876fef-3d51-4a83-89c5-6506d9a19d58	teste 0002	2026-08-18 11:51:43.219	2026-08-18 11:51:43.219	\N
baee3b40-2785-4833-9ca7-1687c5a568e9	94ecfea0-859e-45da-a1d0-e0f238211a2f	cdd21cfe-6d5e-491b-80a9-f8116e4fac68	ea876fef-3d51-4a83-89c5-6506d9a19d58	teste 03	2026-08-18 12:30:24.009	2026-08-18 12:30:24.009	\N
\.


--
-- Data for Name: task_priorities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_priorities (id, tenant_id, name, level, color, created_at) FROM stdin;
f7586043-356a-49aa-a768-ecbdceeb44a2	94ecfea0-859e-45da-a1d0-e0f238211a2f	Baixa	1	#94A3B8	2026-08-16 22:21:54.661
e7eba96e-4000-4985-91d1-df6482e72ca8	94ecfea0-859e-45da-a1d0-e0f238211a2f	Normal	2	#3B82F6	2026-08-16 22:21:54.663
88dda453-9cb3-48c2-91a8-00735b79ad43	94ecfea0-859e-45da-a1d0-e0f238211a2f	Alta	3	#F59E0B	2026-08-16 22:21:54.665
84eef310-583a-487b-9a1b-6c8061fffc73	94ecfea0-859e-45da-a1d0-e0f238211a2f	Urgente	4	#EF4444	2026-08-16 22:21:54.666
\.


--
-- Data for Name: task_statuses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_statuses (id, tenant_id, name, slug, color, "position", category, is_default, created_at) FROM stdin;
331e7776-a789-435d-8fd1-39313147d82e	94ecfea0-859e-45da-a1d0-e0f238211a2f	Backlog	backlog	#64748B	1	pending	f	2026-08-16 22:21:54.649
66c96a35-f8d0-4816-a3f5-8099dca0a159	94ecfea0-859e-45da-a1d0-e0f238211a2f	A Fazer	a_fazer	#3B82F6	2	pending	t	2026-08-16 22:21:54.652
d0192ddd-c1a3-4ab7-b3ba-eb77d1e3f591	94ecfea0-859e-45da-a1d0-e0f238211a2f	Em Execu├º├úo	em_execucao	#F59E0B	3	active	f	2026-08-16 22:21:54.654
3a30c352-66e0-482a-9f13-81cb883f6bb8	94ecfea0-859e-45da-a1d0-e0f238211a2f	Revis├úo	revisao	#8B5CF6	4	active	f	2026-08-16 22:21:54.656
d53f6d1f-b6fb-45ea-9a00-18c8838a5740	94ecfea0-859e-45da-a1d0-e0f238211a2f	Conclu├¡do	concluido	#22C55E	5	done	f	2026-08-16 22:21:54.658
\.


--
-- Data for Name: task_tag_links; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_tag_links (id, tenant_id, task_id, tag_id) FROM stdin;
\.


--
-- Data for Name: task_tags; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_tags (id, tenant_id, name, color, created_at) FROM stdin;
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tasks (id, tenant_id, project_id, parent_task_id, title, description, status_id, priority_id, assignee_tenant_user_id, reporter_tenant_user_id, team_id, start_date, due_date, completed_at, estimated_minutes, spent_minutes, story_points, kanban_position, sort_order, is_blocked, blocked_reason, created_at, updated_at, archived_at) FROM stdin;
ef610797-c553-4c24-b236-d5767a1f3cc3	94ecfea0-859e-45da-a1d0-e0f238211a2f	fa49202c-9f0f-4525-b86e-f52afd002347	\N	Criar identidade visual	\N	331e7776-a789-435d-8fd1-39313147d82e	e7eba96e-4000-4985-91d1-df6482e72ca8	ea876fef-3d51-4a83-89c5-6506d9a19d58	ea876fef-3d51-4a83-89c5-6506d9a19d58	\N	\N	\N	\N	\N	0	\N	2000	1	f	\N	2026-08-16 22:21:54.685	2026-08-18 11:28:20.79	\N
13ccab17-02d2-4248-aff0-c773c6617533	94ecfea0-859e-45da-a1d0-e0f238211a2f	fa49202c-9f0f-4525-b86e-f52afd002347	\N	Publicar vers├úo alfa	\N	d53f6d1f-b6fb-45ea-9a00-18c8838a5740	e7eba96e-4000-4985-91d1-df6482e72ca8	ea876fef-3d51-4a83-89c5-6506d9a19d58	ea876fef-3d51-4a83-89c5-6506d9a19d58	\N	\N	\N	\N	\N	0	\N	1000	4	f	\N	2026-08-16 22:21:54.69	2026-08-18 11:28:25.782	\N
0b94e2d8-273b-4be0-8e68-c04c035c023c	94ecfea0-859e-45da-a1d0-e0f238211a2f	fa49202c-9f0f-4525-b86e-f52afd002347	\N	Homologar autentica├º├úo	teste de descri├º├úo	d53f6d1f-b6fb-45ea-9a00-18c8838a5740	84eef310-583a-487b-9a1b-6c8061fffc73	ea876fef-3d51-4a83-89c5-6506d9a19d58	ea876fef-3d51-4a83-89c5-6506d9a19d58	\N	\N	\N	\N	\N	0	\N	2000	3	f	\N	2026-08-16 22:21:54.689	2026-08-18 12:36:21.233	\N
df5d4373-287b-4c52-bde6-8da8704ad8f3	94ecfea0-859e-45da-a1d0-e0f238211a2f	fa49202c-9f0f-4525-b86e-f52afd002347	\N	Configurar VPS	\N	d53f6d1f-b6fb-45ea-9a00-18c8838a5740	e7eba96e-4000-4985-91d1-df6482e72ca8	ea876fef-3d51-4a83-89c5-6506d9a19d58	ea876fef-3d51-4a83-89c5-6506d9a19d58	\N	\N	\N	\N	\N	0	\N	1500	0	f	\N	2026-08-16 22:21:54.682	2026-08-18 12:33:23.701	\N
8899cff6-06a7-4f35-9560-da222c524521	94ecfea0-859e-45da-a1d0-e0f238211a2f	fa49202c-9f0f-4525-b86e-f52afd002347	\N	Definir fluxo de kanban	\N	d53f6d1f-b6fb-45ea-9a00-18c8838a5740	e7eba96e-4000-4985-91d1-df6482e72ca8	ea876fef-3d51-4a83-89c5-6506d9a19d58	ea876fef-3d51-4a83-89c5-6506d9a19d58	\N	\N	\N	\N	\N	0	\N	1750	2	f	\N	2026-08-16 22:21:54.687	2026-08-18 12:33:25.387	\N
cdd21cfe-6d5e-491b-80a9-f8116e4fac68	94ecfea0-859e-45da-a1d0-e0f238211a2f	fa49202c-9f0f-4525-b86e-f52afd002347	\N	teste de cria├º├ú		d53f6d1f-b6fb-45ea-9a00-18c8838a5740	84eef310-583a-487b-9a1b-6c8061fffc73	\N	\N	\N	\N	\N	\N	\N	0	\N	1875	0	f	\N	2026-08-18 11:29:37.702	2026-08-18 12:33:27.146	\N
\.


--
-- Data for Name: team_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.team_members (id, tenant_id, team_id, tenant_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.teams (id, tenant_id, name, description, manager_tenant_user_id, color, created_at, updated_at) FROM stdin;
544b07e6-4544-4c56-aec9-bc1ef342c7fc	94ecfea0-859e-45da-a1d0-e0f238211a2f	Opera├º├Áes	Equipe de opera├º├Áes	ea876fef-3d51-4a83-89c5-6506d9a19d58	#5B5FEF	2026-08-16 22:21:54.67	2026-08-16 22:21:54.67
\.


--
-- Data for Name: tenant_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tenant_users (id, tenant_id, user_id, role_id, job_title, department, is_active, created_at, updated_at, status, must_change_password, last_invite_at, disabled_at, disabled_reason) FROM stdin;
ea876fef-3d51-4a83-89c5-6506d9a19d58	94ecfea0-859e-45da-a1d0-e0f238211a2f	8b4ce856-138c-4b1d-b609-23c565929df8	admin	Administrador do Sistema	TI	t	2026-08-16 22:21:54.646	2026-08-16 22:21:54.646	ACTIVE	f	\N	\N	\N
38051273-f879-4c29-a77d-f950f1fba8ec	94ecfea0-859e-45da-a1d0-e0f238211a2f	344d2691-47b1-4550-9395-f4fb69ec46b7	colaborador	\N	\N	t	2026-08-16 22:37:29.6	2026-08-16 22:37:29.6	ACTIVE	f	\N	\N	\N
\.


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tenants (id, name, slug, legal_name, document_number, email, phone, status, created_at, updated_at) FROM stdin;
94ecfea0-859e-45da-a1d0-e0f238211a2f	Monte Moria Demo	monte-moria-demo	Monte Moria Demo LTDA	00.000.000/0001-00	admin@montemoria.local	+55 19 99999-9999	ACTIVE	2026-08-16 22:20:58.23	2026-08-16 22:20:58.23
\.


--
-- Data for Name: token_denylist; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.token_denylist (id, token_hash, user_id, reason, expires_at, created_at) FROM stdin;
ef613468-44e9-4f9e-8a35-2aa63d9eb052	access:11fa35960388b538ff391fce00884ae64aab695e0cc345dc0fa64e872ea5e4db	344d2691-47b1-4550-9395-f4fb69ec46b7	logout	2026-08-16 22:52:39.59	2026-08-16 22:37:39.591
86e1f467-432b-4aeb-b0de-9e7c05227fc9	access:b1e20d49cd88edc94a5e2506b7121bfe8a3e26a3e83b1efe8a2a3f71df6a50cc	344d2691-47b1-4550-9395-f4fb69ec46b7	logout	2026-08-16 23:07:49.183	2026-08-16 22:52:49.184
d076dec4-c1a0-4e7f-976e-b24cb7d70000	access:3fc98dfd9011c5e033a9a35c79aa8e617e13201aae3cb1f3b3d4d13b61572282	8b4ce856-138c-4b1d-b609-23c565929df8	logout	2026-08-17 18:24:04.172	2026-08-17 18:09:04.173
614ea2e3-c46a-4edb-92b7-50c4855f6dfb	access:3150d9352e662f7c9d8945526d813e8deaaae53abd4c180e467a7deaa62eaa4b	344d2691-47b1-4550-9395-f4fb69ec46b7	logout	2026-08-17 19:26:22.655	2026-08-17 19:11:22.657
16b1fc9f-7462-4530-b4ec-ed91e8f9aeee	access:bcd62136f0bd2bf614b1df261102eb0d367ee38a9c6d0e8c43f8faffa576fbac	344d2691-47b1-4550-9395-f4fb69ec46b7	logout	2026-08-17 19:26:43.142	2026-08-17 19:11:43.145
352d30d3-bc93-49fe-82ec-067e01ac50d9	access:607f9037e119eb09c97e01e4f09781411e73571e66023a5038b29b919d7792b0	8b4ce856-138c-4b1d-b609-23c565929df8	logout	2026-08-17 19:35:47.974	2026-08-17 19:20:47.976
13979d98-d59d-4a77-aac1-9a4d03088621	access:86cbfc660d87b214736f26aff4730634989dbe3b0ef0cff9e0d84212b885c688	344d2691-47b1-4550-9395-f4fb69ec46b7	logout	2026-08-17 19:53:28.114	2026-08-17 19:38:28.115
e31a4e5d-1150-42ce-9842-c12c1da25364	access:9da7c5d4d0df93b91a4c16b6e68d0ebb7520b5820af4bc077de00ed5e973c1bd	8b4ce856-138c-4b1d-b609-23c565929df8	logout	2026-08-17 20:02:47.325	2026-08-17 19:47:47.326
57583669-bd9e-4d72-a2ef-6c067c24e3c5	access:ad69181537ec586b161a33fe470570ee77c6b439d8351b6a0a1033bcd4658716	344d2691-47b1-4550-9395-f4fb69ec46b7	logout	2026-08-17 20:17:29.873	2026-08-17 20:02:29.874
4aa84526-dbed-44f0-a00a-c201985abcd2	access:310f4ee7e78fe3cf1c9277710444cf55f4b3a1a677b672596df1b0ed1c8f01b2	8b4ce856-138c-4b1d-b609-23c565929df8	logout	2026-08-18 12:19:34.416	2026-08-18 12:04:34.418
70683dd6-b110-42f1-a63e-b96139c976af	access:7e8bd8e2c6fb5cc409d5709dafc66887f1f31b014326f29ddb25982d1950045f	344d2691-47b1-4550-9395-f4fb69ec46b7	logout	2026-08-18 12:19:53.788	2026-08-18 12:04:53.79
d1adc8f9-2ac2-41b3-a563-e0292c37bc92	access:cdda089247be635f851c2ab3190c40fbe61055efe200bc917b187ed37ae1c4c1	8b4ce856-138c-4b1d-b609-23c565929df8	logout	2026-08-18 12:20:41.855	2026-08-18 12:05:41.856
\.


--
-- Data for Name: usage_counters; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.usage_counters (id, tenant_id, metric_code, current_value, period_start, period_end, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, password_hash, avatar_url, phone, is_active, last_login_at, created_at, updated_at) FROM stdin;
344d2691-47b1-4550-9395-f4fb69ec46b7	testador	teste@teste.com.br	$2b$12$17eNVT6wOfPwkRqRmsMRvuGEzeLhOiOeKSJ20AoAsjUaKfWUj66jG	\N	\N	t	2026-08-18 12:05:51.82	2026-08-16 22:37:29.596	2026-08-18 12:05:51.821
8b4ce856-138c-4b1d-b609-23c565929df8	Administrador	admin@montemoria.com.br	$2b$12$wz1Y5juLupQL4gQhuqhCxeSHd9Rzx2XtaHKST9VpzLI6xNGEvCoJC	\N	\N	t	2026-08-18 12:07:56.165	2026-08-16 22:21:54.636	2026-08-18 12:07:56.166
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: automations automations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automations
    ADD CONSTRAINT automations_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: custom_field_values custom_field_values_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_field_values
    ADD CONSTRAINT custom_field_values_pkey PRIMARY KEY (id);


--
-- Name: custom_fields custom_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_fields
    ADD CONSTRAINT custom_fields_pkey PRIMARY KEY (id);


--
-- Name: daily_routine_items daily_routine_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_routine_items
    ADD CONSTRAINT daily_routine_items_pkey PRIMARY KEY (id);


--
-- Name: daily_routine_logs daily_routine_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_routine_logs
    ADD CONSTRAINT daily_routine_logs_pkey PRIMARY KEY (id);


--
-- Name: daily_routine_logs daily_routine_logs_routine_item_id_tenant_user_id_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_routine_logs
    ADD CONSTRAINT daily_routine_logs_routine_item_id_tenant_user_id_date_key UNIQUE (routine_item_id, tenant_user_id, date);


--
-- Name: email_settings email_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_settings
    ADD CONSTRAINT email_settings_pkey PRIMARY KEY (id);


--
-- Name: email_tenant_settings email_tenant_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_tenant_settings
    ADD CONSTRAINT email_tenant_settings_pkey PRIMARY KEY (id);


--
-- Name: event_attendees event_attendees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_attendees
    ADD CONSTRAINT event_attendees_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: login_attempts login_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_attempts
    ADD CONSTRAINT login_attempts_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_pkey PRIMARY KEY (id);


--
-- Name: project_views project_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_views
    ADD CONSTRAINT project_views_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: task_assignees task_assignees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_assignees
    ADD CONSTRAINT task_assignees_pkey PRIMARY KEY (id);


--
-- Name: task_checklist_items task_checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_checklist_items
    ADD CONSTRAINT task_checklist_items_pkey PRIMARY KEY (id);


--
-- Name: task_checklists task_checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_checklists
    ADD CONSTRAINT task_checklists_pkey PRIMARY KEY (id);


--
-- Name: task_comments task_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_pkey PRIMARY KEY (id);


--
-- Name: task_priorities task_priorities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_priorities
    ADD CONSTRAINT task_priorities_pkey PRIMARY KEY (id);


--
-- Name: task_statuses task_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_statuses
    ADD CONSTRAINT task_statuses_pkey PRIMARY KEY (id);


--
-- Name: task_tag_links task_tag_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_tag_links
    ADD CONSTRAINT task_tag_links_pkey PRIMARY KEY (id);


--
-- Name: task_tags task_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_tags
    ADD CONSTRAINT task_tags_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: tenant_users tenant_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_users
    ADD CONSTRAINT tenant_users_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: token_denylist token_denylist_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_denylist
    ADD CONSTRAINT token_denylist_pkey PRIMARY KEY (id);


--
-- Name: token_denylist token_denylist_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_denylist
    ADD CONSTRAINT token_denylist_token_hash_key UNIQUE (token_hash);


--
-- Name: usage_counters usage_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usage_counters
    ADD CONSTRAINT usage_counters_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: daily_routine_items_assigned_tenant_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX daily_routine_items_assigned_tenant_user_id_idx ON public.daily_routine_items USING btree (assigned_tenant_user_id);


--
-- Name: daily_routine_items_created_by_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX daily_routine_items_created_by_id_idx ON public.daily_routine_items USING btree (created_by_id);


--
-- Name: daily_routine_items_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX daily_routine_items_tenant_id_idx ON public.daily_routine_items USING btree (tenant_id);


--
-- Name: daily_routine_logs_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX daily_routine_logs_date_idx ON public.daily_routine_logs USING btree (date);


--
-- Name: daily_routine_logs_routine_item_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX daily_routine_logs_routine_item_id_idx ON public.daily_routine_logs USING btree (routine_item_id);


--
-- Name: daily_routine_logs_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX daily_routine_logs_tenant_id_idx ON public.daily_routine_logs USING btree (tenant_id);


--
-- Name: daily_routine_logs_tenant_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX daily_routine_logs_tenant_user_id_idx ON public.daily_routine_logs USING btree (tenant_user_id);


--
-- Name: email_settings_tenant_user_id_protocol_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX email_settings_tenant_user_id_protocol_key ON public.email_settings USING btree (tenant_user_id, protocol);


--
-- Name: email_tenant_settings_email_domain_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_tenant_settings_email_domain_idx ON public.email_tenant_settings USING btree (email_domain);


--
-- Name: email_tenant_settings_tenant_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX email_tenant_settings_tenant_id_key ON public.email_tenant_settings USING btree (tenant_id);


--
-- Name: event_attendees_event_id_tenant_user_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX event_attendees_event_id_tenant_user_id_key ON public.event_attendees USING btree (event_id, tenant_user_id);


--
-- Name: login_attempts_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX login_attempts_created_at_idx ON public.login_attempts USING btree (created_at);


--
-- Name: login_attempts_email_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX login_attempts_email_idx ON public.login_attempts USING btree (email);


--
-- Name: login_attempts_ip_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX login_attempts_ip_address_idx ON public.login_attempts USING btree (ip_address);


--
-- Name: notifications_tenant_id_tenant_user_id_is_read_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notifications_tenant_id_tenant_user_id_is_read_idx ON public.notifications USING btree (tenant_id, tenant_user_id, is_read);


--
-- Name: permissions_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX permissions_code_key ON public.permissions USING btree (code);


--
-- Name: project_members_project_id_tenant_user_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX project_members_project_id_tenant_user_id_key ON public.project_members USING btree (project_id, tenant_user_id);


--
-- Name: projects_tenant_id_owner_tenant_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX projects_tenant_id_owner_tenant_user_id_idx ON public.projects USING btree (tenant_id, owner_tenant_user_id);


--
-- Name: projects_tenant_id_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX projects_tenant_id_status_idx ON public.projects USING btree (tenant_id, status);


--
-- Name: refresh_tokens_expires_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX refresh_tokens_expires_at_idx ON public.refresh_tokens USING btree (expires_at);


--
-- Name: refresh_tokens_family_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX refresh_tokens_family_idx ON public.refresh_tokens USING btree (family);


--
-- Name: refresh_tokens_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX refresh_tokens_tenant_id_idx ON public.refresh_tokens USING btree (tenant_id);


--
-- Name: refresh_tokens_token_hash_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX refresh_tokens_token_hash_key ON public.refresh_tokens USING btree (token_hash);


--
-- Name: refresh_tokens_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX refresh_tokens_user_id_idx ON public.refresh_tokens USING btree (user_id);


--
-- Name: role_permissions_role_id_permission_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX role_permissions_role_id_permission_id_key ON public.role_permissions USING btree (role_id, permission_id);


--
-- Name: task_assignees_task_id_tenant_user_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX task_assignees_task_id_tenant_user_id_key ON public.task_assignees USING btree (task_id, tenant_user_id);


--
-- Name: task_statuses_tenant_id_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX task_statuses_tenant_id_slug_key ON public.task_statuses USING btree (tenant_id, slug);


--
-- Name: task_tag_links_task_id_tag_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX task_tag_links_task_id_tag_id_key ON public.task_tag_links USING btree (task_id, tag_id);


--
-- Name: tasks_tenant_id_archived_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tasks_tenant_id_archived_at_idx ON public.tasks USING btree (tenant_id, archived_at);


--
-- Name: tasks_tenant_id_assignee_tenant_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tasks_tenant_id_assignee_tenant_user_id_idx ON public.tasks USING btree (tenant_id, assignee_tenant_user_id);


--
-- Name: tasks_tenant_id_due_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tasks_tenant_id_due_date_idx ON public.tasks USING btree (tenant_id, due_date);


--
-- Name: tasks_tenant_id_project_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tasks_tenant_id_project_id_idx ON public.tasks USING btree (tenant_id, project_id);


--
-- Name: tasks_tenant_id_status_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tasks_tenant_id_status_id_idx ON public.tasks USING btree (tenant_id, status_id);


--
-- Name: team_members_team_id_tenant_user_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX team_members_team_id_tenant_user_id_key ON public.team_members USING btree (team_id, tenant_user_id);


--
-- Name: tenant_users_tenant_id_user_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX tenant_users_tenant_id_user_id_key ON public.tenant_users USING btree (tenant_id, user_id);


--
-- Name: tenants_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX tenants_slug_key ON public.tenants USING btree (slug);


--
-- Name: token_denylist_expires_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX token_denylist_expires_at_idx ON public.token_denylist USING btree (expires_at);


--
-- Name: token_denylist_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX token_denylist_user_id_idx ON public.token_denylist USING btree (user_id);


--
-- Name: usage_counters_tenant_id_metric_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX usage_counters_tenant_id_metric_code_key ON public.usage_counters USING btree (tenant_id, metric_code);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: activity_logs activity_logs_actor_tenant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_actor_tenant_user_id_fkey FOREIGN KEY (actor_tenant_user_id) REFERENCES public.tenant_users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: activity_logs activity_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: attachments attachments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: attachments attachments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: attachments attachments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: attachments attachments_uploaded_by_tenant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_uploaded_by_tenant_user_id_fkey FOREIGN KEY (uploaded_by_tenant_user_id) REFERENCES public.tenant_users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: audit_logs audit_logs_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: automations automations_created_by_tenant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automations
    ADD CONSTRAINT automations_created_by_tenant_user_id_fkey FOREIGN KEY (created_by_tenant_user_id) REFERENCES public.tenant_users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: automations automations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automations
    ADD CONSTRAINT automations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: contacts contacts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: custom_field_values custom_field_values_custom_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_field_values
    ADD CONSTRAINT custom_field_values_custom_field_id_fkey FOREIGN KEY (custom_field_id) REFERENCES public.custom_fields(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: custom_field_values custom_field_values_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_field_values
    ADD CONSTRAINT custom_field_values_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: custom_fields custom_fields_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_fields
    ADD CONSTRAINT custom_fields_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: daily_routine_items daily_routine_items_assigned_tenant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_routine_items
    ADD CONSTRAINT daily_routine_items_assigned_tenant_user_id_fkey FOREIGN KEY (assigned_tenant_user_id) REFERENCES public.tenant_users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: daily_routine_items daily_routine_items_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_routine_items
    ADD CONSTRAINT daily_routine_items_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.tenant_users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: daily_routine_items daily_routine_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_routine_items
    ADD CONSTRAINT daily_routine_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: daily_routine_logs daily_routine_logs_routine_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_routine_logs
    ADD CONSTRAINT daily_routine_logs_routine_item_id_fkey FOREIGN KEY (routine_item_id) REFERENCES public.daily_routine_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: daily_routine_logs daily_routine_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_routine_logs
    ADD CONSTRAINT daily_routine_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: daily_routine_logs daily_routine_logs_tenant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_routine_logs
    ADD CONSTRAINT daily_routine_logs_tenant_user_id_fkey FOREIGN KEY (tenant_user_id) REFERENCES public.tenant_users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: email_settings email_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_settings
    ADD CONSTRAINT email_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: email_settings email_settings_tenant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_settings
    ADD CONSTRAINT email_settings_tenant_user_id_fkey FOREIGN KEY (tenant_user_id) REFERENCES public.tenant_users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: email_tenant_settings email_tenant_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_tenant_settings
    ADD CONSTRAINT email_tenant_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: email_tenant_settings email_tenant_settings_updated_by_tenant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_tenant_settings
    ADD CONSTRAINT email_tenant_settings_updated_by_tenant_user_id_fkey FOREIGN KEY (updated_by_tenant_user_id) REFERENCES public.tenant_users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: event_attendees event_attendees_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_attendees
    ADD CONSTRAINT event_attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: event_attendees event_attendees_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_attendees
    ADD CONSTRAINT event_attendees_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: event_attendees event_attendees_tenant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_attendees
    ADD CONSTRAINT event_attendees_tenant_user_id_fkey FOREIGN KEY (tenant_user_id) REFERENCES public.tenant_users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: events events_created_by_tenant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_tenant_user_id_fkey FOREIGN KEY (created_by_tenant_user_id) REFERENCES public.tenant_users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: events events_related_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_related_project_id_fkey FOREIGN KEY (related_project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: events events_related_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_related_task_id_fkey FOREIGN KEY (related_task_id) REFERENCES public.tasks(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: events events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notifications notifications_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notifications notifications_tenant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_tenant_user_id_fkey FOREIGN KEY (tenant_user_id) REFERENCES public.tenant_users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: project_members project_members_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: project_members project_members_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: project_members project_members_tenant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_tenant_user_id_fkey FOREIGN KEY (tenant_user_id) REFERENCES public.tenant_users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: project_views project_views_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_views
    ADD CONSTRAINT project_views_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: project_views project_views_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_views
    ADD CONSTRAINT project_views_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: projects projects_owner_tenant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_owner_tenant_user_id_fkey FOREIGN KEY (owner_tenant_user_id) REFERENCES public.tenant_users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: projects projects_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: projects projects_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: roles roles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: subscriptions subscriptions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_assignees task_assignees_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_assignees
    ADD CONSTRAINT task_assignees_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_assignees task_assignees_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_assignees
    ADD CONSTRAINT task_assignees_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_assignees task_assignees_tenant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_assignees
    ADD CONSTRAINT task_assignees_tenant_user_id_fkey FOREIGN KEY (tenant_user_id) REFERENCES public.tenant_users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_checklist_items task_checklist_items_checklist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_checklist_items
    ADD CONSTRAINT task_checklist_items_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES public.task_checklists(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_checklist_items task_checklist_items_done_by_tenant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_checklist_items
    ADD CONSTRAINT task_checklist_items_done_by_tenant_user_id_fkey FOREIGN KEY (done_by_tenant_user_id) REFERENCES public.tenant_users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: task_checklist_items task_checklist_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_checklist_items
    ADD CONSTRAINT task_checklist_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_checklists task_checklists_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_checklists
    ADD CONSTRAINT task_checklists_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_checklists task_checklists_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_checklists
    ADD CONSTRAINT task_checklists_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_comments task_comments_author_tenant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_author_tenant_user_id_fkey FOREIGN KEY (author_tenant_user_id) REFERENCES public.tenant_users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: task_comments task_comments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_comments task_comments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_priorities task_priorities_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_priorities
    ADD CONSTRAINT task_priorities_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_statuses task_statuses_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_statuses
    ADD CONSTRAINT task_statuses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_tag_links task_tag_links_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_tag_links
    ADD CONSTRAINT task_tag_links_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.task_tags(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_tag_links task_tag_links_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_tag_links
    ADD CONSTRAINT task_tag_links_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_tag_links task_tag_links_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_tag_links
    ADD CONSTRAINT task_tag_links_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_tags task_tags_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_tags
    ADD CONSTRAINT task_tags_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tasks tasks_assignee_tenant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assignee_tenant_user_id_fkey FOREIGN KEY (assignee_tenant_user_id) REFERENCES public.tenant_users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tasks tasks_parent_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_parent_task_id_fkey FOREIGN KEY (parent_task_id) REFERENCES public.tasks(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tasks tasks_priority_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_priority_id_fkey FOREIGN KEY (priority_id) REFERENCES public.task_priorities(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tasks tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tasks tasks_reporter_tenant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_reporter_tenant_user_id_fkey FOREIGN KEY (reporter_tenant_user_id) REFERENCES public.tenant_users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tasks tasks_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.task_statuses(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tasks tasks_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tasks tasks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: team_members team_members_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: team_members team_members_tenant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_tenant_user_id_fkey FOREIGN KEY (tenant_user_id) REFERENCES public.tenant_users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: teams teams_manager_tenant_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_manager_tenant_user_id_fkey FOREIGN KEY (manager_tenant_user_id) REFERENCES public.tenant_users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: teams teams_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tenant_users tenant_users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_users
    ADD CONSTRAINT tenant_users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tenant_users tenant_users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_users
    ADD CONSTRAINT tenant_users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tenant_users tenant_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_users
    ADD CONSTRAINT tenant_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: usage_counters usage_counters_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usage_counters
    ADD CONSTRAINT usage_counters_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict CGyhgaBZCU5NxGHL6asHiWoagaRVeYdEuTxscdSTWgnGAFCBsOdo4qeRIfhtZwG

