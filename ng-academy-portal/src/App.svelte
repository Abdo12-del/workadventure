<!--
    NG Academy — أكاديمية الجيل الجديد
    Portal shell: login + role-routed dashboards (parent / teacher / admin).
    Children have no portal route at all — the world itself is their homepage
    (requirements 12 & 19).
-->
<script lang="ts">
    import { onMount } from "svelte";
    import { ngHomeRouteFor, ngLogout, ngMe, ngRefreshMe } from "./lib/auth";
    import { ngNavigate, ngRoute } from "./lib/router";
    import Login from "./pages/Login.svelte";
    import ParentDashboard from "./pages/Parent.svelte";
    import TeacherDashboard from "./pages/Teacher.svelte";
    import AdminDashboard from "./pages/Admin.svelte";

    onMount(() => {
        ngRefreshMe().catch(() => {});
    });

    const screen = $derived.by(() => {
        const me = $ngMe;
        if (!me) return "login" as const;
        const wanted = $ngRoute;
        if (wanted === "/parent" && me.role === "parent") return "parent" as const;
        if (wanted === "/teacher" && me.role === "teacher") return "teacher" as const;
        if (wanted === "/admin" && (me.role === "admin" || me.role === "owner")) return "admin" as const;
        return "home" as const;
    });

    function logout(): void {
        ngLogout();
        ngNavigate("/login");
    }
</script>

<header class="ng-header">
    <div class="ng-brand">
        🦉 أكاديمية الجيل الجديد
        <small>بوابة ولي الأمر والمعلمين والإدارة</small>
    </div>
    {#if $ngMe}
        <nav class="ng-nav">
            <button type="button" class="ng-btn secondary" onclick={() => ngNavigate(ngHomeRouteFor($ngMe?.role))}>
                لوحتي
            </button>
            <span class="ng-muted">{$ngMe.name}</span>
            <button type="button" class="ng-btn secondary" onclick={logout}>تسجيل الخروج</button>
        </nav>
    {/if}
</header>

<main class="ng-main">
    {#if screen === "login"}
        <Login />
    {:else if screen === "parent"}
        <ParentDashboard />
    {:else if screen === "teacher"}
        <TeacherDashboard />
    {:else if screen === "admin"}
        <AdminDashboard />
    {:else}
        {#if $ngMe?.role === "parent"}
            <ParentDashboard />
        {:else if $ngMe?.role === "teacher"}
            <TeacherDashboard />
        {:else}
            <AdminDashboard />
        {/if}
    {/if}
</main>
