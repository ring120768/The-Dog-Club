(() => {
  "use strict";
  const state = {
    token: "",
    sessionId: "",
    sessionExpiresAt: "",
    server: "",
    clubs: [],
    club: null,
    dog: null,
    photoUrl: "",
    bookingOptions: null,
    rescheduleBooking: null,
    checkoutRequestId: null,
    pendingCheckout: null,
  };
  const byId = (id) => document.getElementById(id);
  const views = [
    "login-view",
    "club-view",
    "dog-view",
    "profile-view",
    "edit-view",
    "booking-view",
  ];

  function platform() {
    const value = window.Capacitor?.getPlatform?.();
    return value === "ios" || value === "android" ? value : "web_test";
  }
  function serverConfiguration() {
    const configured = window.DOG_CLUB_CONFIG;
    if (!configured?.serverUrl) return { serverUrl: "", locked: false };
    return {
      serverUrl: safeServer(configured.serverUrl),
      locked: configured.locked === true,
    };
  }
  function defaultServer() {
    const configured = serverConfiguration();
    if (configured.serverUrl) return configured.serverUrl;
    if (location.protocol === "http:" || location.protocol === "https:")
      return location.origin;
    return platform() === "android"
      ? "http://10.0.2.2:3100"
      : "http://127.0.0.1:3100";
  }
  function deviceName() {
    if (platform() === "ios") return "Apple device";
    if (platform() === "android") return "Android device";
    return "Browser preview";
  }
  function sessionVault() {
    if (platform() === "web_test") return null;
    return window.Capacitor?.Plugins?.SessionVault ?? null;
  }
  async function persistSession(session) {
    const vault = sessionVault();
    if (!vault?.set) return;
    state.sessionExpiresAt = new Date(
      Date.now() + session.expiresInSeconds * 1000,
    ).toISOString();
    await vault.set({
      value: JSON.stringify({
        token: state.token,
        sessionId: state.sessionId,
        server: state.server,
        expiresAt: state.sessionExpiresAt,
      }),
    });
  }
  async function clearPersistedSession() {
    const vault = sessionVault();
    if (vault?.clear) await vault.clear();
  }
  function show(view) {
    views.forEach((id) => byId(id).classList.toggle("hidden", id !== view));
  }
  function safeServer(value) {
    const url = new URL(value);
    if (url.protocol !== "https:" && !isLocalHttpUrl(url))
      throw new Error(
        "Use an HTTPS server, or a recognised local development address.",
      );
    return url.origin;
  }
  function isLocalHttpUrl(value) {
    const url = value instanceof URL ? value : new URL(value);
    return (
      url.protocol === "http:" &&
      ["127.0.0.1", "10.0.2.2", "localhost"].includes(url.hostname)
    );
  }
  async function request(path, options = {}) {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (state.token) headers.set("Authorization", `Bearer ${state.token}`);
    const response = await fetch(`${state.server}${path}`, {
      ...options,
      headers,
    });
    if (response.status === 401 && path !== "/api/mobile/session")
      void logout(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const error = new Error(
        body.error || "The Dog Club server could not complete that request.",
      );
      error.status = response.status;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  }
  async function photo(path) {
    const response = await fetch(`${state.server}${path}`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (!response.ok) throw new Error("This photo is not available.");
    return response.blob();
  }
  async function changePhoto(method, file) {
    const response = await fetch(
      `${state.server}/api/mobile/clubs/${encodeURIComponent(state.club.slug)}/dogs/${encodeURIComponent(state.dog.id)}/photo`,
      {
        method,
        headers: {
          Authorization: `Bearer ${state.token}`,
          ...(file ? { "Content-Type": "application/octet-stream" } : {}),
        },
        body: file,
      },
    );
    if (response.status === 401) logout(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "The photograph could not be saved.");
    }
  }
  function clearPhoto() {
    if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
    state.photoUrl = "";
    byId("profile-photo").removeAttribute("src");
  }
  function setBusy(form, busy) {
    [...form.elements].forEach((element) => (element.disabled = busy));
  }
  function renderClubs(payload) {
    state.clubs = payload.clubs;
    byId("account-email").textContent = payload.account.email;
    const list = byId("club-list");
    list.replaceChildren();
    payload.clubs.forEach((club) => {
      const button = document.createElement("button");
      button.className = "club";
      button.type = "button";
      button.innerHTML = "<strong></strong><small></small>";
      button.querySelector("strong").textContent = club.name;
      button.querySelector("small").textContent =
        `${club.location} · ${club.role}`;
      button.addEventListener("click", () => openClub(club));
      list.append(button);
    });
    if (!payload.clubs.length)
      byId("club-message").textContent =
        "There are no available club memberships on this account.";
    show("club-view");
  }
  function renderSessions(payload) {
    const list = byId("session-list");
    list.replaceChildren();
    payload.sessions.forEach((session) => {
      const item = document.createElement("li");
      const details = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = session.current
        ? `${session.deviceName} · This device`
        : session.deviceName;
      const used = document.createElement("small");
      used.textContent = `Last used ${formatDateTime(session.lastUsedAt)}`;
      details.append(title, used);
      item.append(details);
      if (!session.current) {
        const revoke = document.createElement("button");
        revoke.type = "button";
        revoke.className = "secondary";
        revoke.textContent = "Sign out device";
        revoke.addEventListener("click", async () => {
          revoke.disabled = true;
          byId("session-message").textContent = "";
          try {
            await request(
              `/api/mobile/sessions/${encodeURIComponent(session.id)}`,
              { method: "DELETE" },
            );
            await refreshSessions();
            byId("session-message").textContent =
              "That device has been signed out.";
          } catch (error) {
            byId("session-message").textContent = error.message;
            revoke.disabled = false;
          }
        });
        item.append(revoke);
      }
      list.append(item);
    });
  }
  async function refreshSessions() {
    renderSessions(await request("/api/mobile/sessions"));
  }
  async function enterSignedInApp() {
    renderClubs(await request("/api/mobile/clubs"));
    await refreshSessions();
  }

  function renderMemberHome(payload) {
    const membership = payload.membership;
    byId("membership-heading").textContent = membership
      ? membership.planName
      : "No current membership";
    byId("membership-status").textContent = membership
      ? membership.state.replaceAll("_", " ")
      : "Ask the club team about the available plans.";
    byId("membership-benefits").textContent = membership
      ? membership.benefitsAvailable
        ? `${membership.remainingGroomingCredits} grooming credits remaining · £${(membership.monthlyPricePence / 100).toFixed(2)} per month`
        : "Membership benefits are currently unavailable."
      : "";
    byId("membership-period").textContent = membership
      ? membership.cancellationEffectiveOn
        ? `Cancellation takes effect ${formatDate(membership.cancellationEffectiveOn)}.`
        : `Current period ends ${formatDate(membership.periodEndsOn)}.`
      : "";

    const list = byId("booking-list");
    list.replaceChildren();
    payload.upcomingBookings.forEach((booking) => {
      const item = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = `${booking.dogName} · ${booking.serviceName}`;
      const detail = document.createElement("p");
      const payment =
        booking.paymentState === "membership_credit"
          ? `${booking.groomingCreditsApplied} membership credit${booking.groomingCreditsApplied === 1 ? "" : "s"}`
          : booking.paymentState === "paid"
            ? `£${(booking.amountDuePence / 100).toFixed(2)} paid`
            : `£${(booking.amountDuePence / 100).toFixed(2)} due`;
      detail.textContent = `${formatDateTime(booking.startsAt)} · ${payment}`;
      const actions = document.createElement("div");
      actions.className = "booking-actions";
      const change = document.createElement("button");
      change.className = "secondary booking-change";
      change.type = "button";
      change.textContent = "Change time";
      change.addEventListener("click", () => openBooking(booking));
      const cancel = document.createElement("button");
      cancel.className = "secondary booking-cancel";
      cancel.type = "button";
      cancel.textContent = "Cancel booking";
      cancel.addEventListener("click", async () => {
        if (
          !confirm(
            `Cancel ${booking.dogName}'s ${booking.serviceName} on ${formatDateTime(booking.startsAt)}?`,
          )
        )
          return;
        cancel.disabled = true;
        byId("dog-message").textContent = "";
        try {
          await request(
            `/api/mobile/clubs/${encodeURIComponent(state.club.slug)}/bookings/${encodeURIComponent(booking.id)}`,
            { method: "DELETE" },
          );
          await openClub(state.club);
          byId("dog-message").textContent =
            "Booking cancelled. Any applied grooming credit has been restored.";
        } catch (error) {
          byId("dog-message").textContent = error.message;
          cancel.disabled = false;
        }
      });
      actions.append(change, cancel);
      item.append(title, detail, actions);
      list.append(item);
    });
    byId("booking-empty").textContent = payload.upcomingBookings.length
      ? ""
      : "No upcoming grooming bookings.";
  }
  function formatDate(value) {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeZone: "Europe/London",
    }).format(new Date(value));
  }
  function formatDateTime(value) {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/London",
    }).format(new Date(value));
  }
  function localDateInput(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Europe/London",
    }).formatToParts(date);
    const part = (type) => parts.find((item) => item.type === type).value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  }
  function selectedBookingDog() {
    return state.bookingOptions?.dogs.find(
      (dog) => dog.id === byId("booking-dog").value,
    );
  }
  function selectedBookingService() {
    return state.bookingOptions?.services.find(
      (service) => service.id === byId("booking-service").value,
    );
  }
  function clearBookingSlots() {
    byId("booking-slots").replaceChildren();
    byId("booking-slot-empty").textContent =
      "Choose Find available times to see appointments.";
  }
  function resetCheckoutAttempt() {
    state.checkoutRequestId = null;
    state.pendingCheckout = null;
    byId("booking-payment-refresh").classList.add("hidden");
  }
  function updateBookingPaymentNote() {
    const service = selectedBookingService();
    const rescheduling = Boolean(state.rescheduleBooking);
    const useCredit =
      !byId("booking-credit-choice").classList.contains("hidden") &&
      byId("booking-credit").checked;
    byId("booking-payment-note").textContent = rescheduling
      ? ""
      : useCredit
        ? "Your selected membership credit covers this booking."
        : service
          ? `Pay £${(service.pricePence / 100).toFixed(2)} securely with Stripe to confirm this appointment.`
          : "";
  }
  function updateBookingSummary() {
    const dog = selectedBookingDog();
    const service = selectedBookingService();
    const membership = state.bookingOptions?.membership;
    const rescheduling = Boolean(state.rescheduleBooking);
    const canUseCredit = Boolean(
      dog?.canUseMembershipCredits &&
      service?.membershipCreditEligible &&
      membership?.benefitsAvailable &&
      membership.remainingGroomingCredits >= service.membershipCreditCost,
    );
    byId("booking-price").textContent = service
      ? rescheduling
        ? `${service.durationMinutes} minutes`
        : `£${(service.pricePence / 100).toFixed(2)} · ${service.durationMinutes} minutes`
      : "";
    byId("booking-terms").textContent = service?.cancellationTerms ?? "";
    const creditChoice = byId("booking-credit-choice");
    creditChoice.classList.toggle("hidden", rescheduling || !canUseCredit);
    byId("booking-credit").checked = canUseCredit;
    byId("booking-credit-copy").textContent = canUseCredit
      ? `Use ${service.membershipCreditCost} of your ${membership.remainingGroomingCredits} remaining grooming credits`
      : "";
    byId("booking-commercial").classList.toggle("hidden", rescheduling);
    byId("booking-terms-accepted").disabled = rescheduling;
    byId("booking-reschedule-note").classList.toggle("hidden", !rescheduling);
    byId("booking-reschedule-note").textContent = rescheduling
      ? "Your original price, grooming credits and cancellation terms stay unchanged."
      : "";
    updateBookingPaymentNote();
    clearBookingSlots();
  }
  function lockRescheduleChoices() {
    const rescheduling = Boolean(state.rescheduleBooking);
    byId("booking-dog").disabled = rescheduling;
    byId("booking-service").disabled = rescheduling;
    byId("booking-terms-accepted").disabled = rescheduling;
  }
  async function openBooking(booking = null) {
    const message = byId("booking-message");
    message.textContent = "";
    state.rescheduleBooking = booking;
    resetCheckoutAttempt();
    try {
      const options = await request(
        `/api/mobile/clubs/${encodeURIComponent(state.club.slug)}/booking-options`,
      );
      state.bookingOptions = options;
      const dogSelect = byId("booking-dog");
      const serviceSelect = byId("booking-service");
      dogSelect.replaceChildren();
      serviceSelect.replaceChildren();
      options.dogs.forEach((dog) => {
        const option = document.createElement("option");
        option.value = dog.id;
        option.textContent = dog.name;
        dogSelect.append(option);
      });
      options.services.forEach((service) => {
        const option = document.createElement("option");
        option.value = service.id;
        option.textContent = service.name;
        serviceSelect.append(option);
      });
      if (booking) {
        dogSelect.value = booking.dogId;
        serviceSelect.value = booking.serviceId;
      }
      byId("booking-heading").textContent = booking
        ? "Change appointment"
        : "Book a groom";
      byId("booking-submit").textContent = booking
        ? "Confirm new time"
        : "Confirm booking";
      byId("booking-date").min = localDateInput();
      byId("booking-date").value = booking
        ? localDateInput(new Date(booking.startsAt))
        : localDateInput(new Date(Date.now() + 24 * 60 * 60 * 1000));
      byId("booking-setup-empty").textContent = options.dogs.length
        ? options.services.length
          ? ""
          : "This club has no active grooming services."
        : "No approved dogs are available for grooming bookings.";
      byId("booking-search").disabled =
        !options.dogs.length || !options.services.length;
      byId("booking-terms-accepted").checked = false;
      updateBookingSummary();
      lockRescheduleChoices();
      show("booking-view");
    } catch (error) {
      message.textContent = error.message;
      show("booking-view");
    }
  }
  async function openClub(club) {
    byId("club-message").textContent = "";
    try {
      const [payload, home] = await Promise.all([
        request(`/api/mobile/clubs/${encodeURIComponent(club.slug)}/dogs`),
        request(`/api/mobile/clubs/${encodeURIComponent(club.slug)}/home`),
      ]);
      state.club = club;
      byId("club-name").textContent = payload.club.name;
      renderMemberHome(home);
      const list = byId("dog-list");
      list.replaceChildren();
      payload.dogs.forEach((dog) => {
        const article = document.createElement("button");
        article.className = "dog";
        article.type = "button";
        const initial = document.createElement("div");
        initial.className = `avatar ${dog.avatar}`;
        initial.textContent = dog.name.slice(0, 1).toUpperCase();
        const copy = document.createElement("div");
        const title = document.createElement("h3");
        title.textContent = dog.name;
        const breed = document.createElement("span");
        breed.className = "muted";
        breed.textContent = dog.breed;
        const bio = document.createElement("p");
        bio.textContent = dog.bio;
        copy.append(title, breed, bio);
        if (dog.canManage) {
          const pill = document.createElement("span");
          pill.className = "pill";
          pill.textContent = "Your dog";
          copy.append(pill);
        }
        article.append(initial, copy);
        article.addEventListener("click", () => openDog(dog.id));
        list.append(article);
      });
      byId("dog-message").textContent = payload.dogs.length
        ? ""
        : "No dog profiles are visible yet.";
      show("dog-view");
    } catch (error) {
      byId("club-message").textContent = error.message;
    }
  }
  async function refreshCheckoutStatus() {
    if (!state.pendingCheckout) return;
    const message = byId("booking-message");
    const refresh = byId("booking-payment-refresh");
    refresh.disabled = true;
    try {
      const result = await request(
        `/api/mobile/clubs/${encodeURIComponent(state.club.slug)}/service-checkouts/${encodeURIComponent(state.pendingCheckout.bookingId)}`,
      );
      if (result.status === "confirmed") {
        state.pendingCheckout = null;
        state.checkoutRequestId = null;
        refresh.classList.add("hidden");
        await openClub(state.club);
        byId("dog-message").textContent =
          "Payment received. Grooming booking confirmed.";
      } else if (result.status === "late_paid") {
        message.textContent =
          "Payment arrived after the appointment hold expired. The club team will contact you.";
      } else if (result.status === "failed") {
        resetCheckoutAttempt();
        message.textContent =
          "Payment was unsuccessful and the appointment hold has been released.";
      } else if (result.status === "expired") {
        resetCheckoutAttempt();
        message.textContent =
          "The 30-minute appointment hold expired. Please choose a new time.";
      } else {
        message.textContent =
          "Payment is still processing. Refresh again in a moment.";
      }
    } catch (error) {
      message.textContent = error.message;
    } finally {
      refresh.disabled = false;
    }
  }
  async function openHostedCheckout(url) {
    const localDemoBrowser = window.Capacitor?.Plugins?.LocalDemoBrowser;
    if (
      platform() === "android" &&
      isLocalHttpUrl(url) &&
      localDemoBrowser?.open
    ) {
      await localDemoBrowser.open({ url });
      return;
    }
    const browser = window.Capacitor?.Plugins?.Browser;
    if (!browser?.open) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    let listener;
    listener = await browser.addListener("browserFinished", async () => {
      await listener?.remove();
      await refreshCheckoutStatus();
    });
    try {
      await browser.open({ url, toolbarColor: "#235448" });
    } catch (error) {
      await listener.remove();
      throw error;
    }
  }
  async function openDog(dogId) {
    const message = byId("profile-message");
    message.textContent = "";
    clearPhoto();
    try {
      const payload = await request(
        `/api/mobile/clubs/${encodeURIComponent(state.club.slug)}/dogs/${encodeURIComponent(dogId)}`,
      );
      const dog = payload.dog;
      state.dog = dog;
      byId("profile-name").textContent = dog.name;
      byId("profile-breed").textContent = dog.breed;
      byId("profile-bio").textContent = dog.bio;
      byId("profile-audience").textContent =
        dog.audience === "public"
          ? "Public profile"
          : dog.audience === "members"
            ? "Club members"
            : "Private profile";
      byId("profile-owner").classList.toggle("hidden", !dog.canManage);
      byId("edit-profile").classList.toggle("hidden", !dog.canManage);
      byId("photo-controls").classList.toggle("hidden", !dog.canManage);
      byId("remove-photo").classList.toggle(
        "hidden",
        !dog.canManage || !dog.photoUrl,
      );
      const image = byId("profile-photo");
      const fallback = byId("profile-avatar");
      fallback.className = `profile-photo avatar ${dog.avatar}`;
      fallback.textContent = dog.name.slice(0, 1).toUpperCase();
      image.alt = `${dog.name}, ${dog.breed}`;
      image.classList.add("hidden");
      fallback.classList.remove("hidden");
      show("profile-view");
      if (dog.photoUrl) {
        state.photoUrl = URL.createObjectURL(await photo(dog.photoUrl));
        image.src = state.photoUrl;
        image.classList.remove("hidden");
        fallback.classList.add("hidden");
      }
    } catch (error) {
      message.textContent = error.message;
    }
  }
  async function logout(notifyServer = true) {
    const token = state.token;
    if (notifyServer && token)
      await request("/api/mobile/session", { method: "DELETE" }).catch(
        () => {},
      );
    await clearPersistedSession().catch(() => {});
    state.token = "";
    state.sessionId = "";
    state.sessionExpiresAt = "";
    state.clubs = [];
    state.club = null;
    state.dog = null;
    state.bookingOptions = null;
    state.rescheduleBooking = null;
    state.checkoutRequestId = null;
    state.pendingCheckout = null;
    clearPhoto();
    show("login-view");
    byId("password").value = "";
  }
  async function restorePersistedSession() {
    const vault = sessionVault();
    if (!vault?.get) return;
    const message = byId("login-message");
    try {
      const stored = await vault.get();
      if (!stored.value) return;
      const session = JSON.parse(stored.value);
      if (
        !/^[a-f0-9]{64}$/.test(session.token) ||
        !/^[0-9a-f-]{36}$/i.test(session.sessionId) ||
        new Date(session.expiresAt).getTime() <= Date.now()
      ) {
        await clearPersistedSession();
        return;
      }
      const configured = serverConfiguration();
      state.server = configured.locked
        ? configured.serverUrl
        : safeServer(session.server);
      state.token = session.token;
      state.sessionId = session.sessionId;
      state.sessionExpiresAt = session.expiresAt;
      byId("server").value = state.server;
      await enterSignedInApp();
    } catch (error) {
      if (!state.token) await clearPersistedSession().catch(() => {});
      state.token = "";
      state.sessionId = "";
      message.textContent =
        error.status === 401
          ? "Your saved sign-in has expired or was signed out. Sign in again."
          : "Your saved sign-in could not be restored. Check your connection and try again.";
    }
  }

  const configuredServer = serverConfiguration();
  byId("server").value = defaultServer();
  if (configuredServer.locked) {
    byId("server").readOnly = true;
    byId("server-setup").classList.add("hidden");
  }
  byId("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = byId("login-message");
    message.textContent = "";
    setBusy(form, true);
    try {
      state.server = safeServer(byId("server").value);
      const session = await request("/api/mobile/session", {
        method: "POST",
        body: JSON.stringify({
          email: byId("email").value,
          password: byId("password").value,
          platform: platform(),
          deviceName: deviceName(),
        }),
      });
      state.token = session.token;
      state.sessionId = session.sessionId;
      const persisted = await persistSession(session)
        .then(() => true)
        .catch(() => false);
      byId("password").value = "";
      await enterSignedInApp();
      if (!persisted && sessionVault())
        byId("club-message").textContent =
          "You are signed in for this visit, but secure session storage is unavailable.";
    } catch (error) {
      const signedIn = Boolean(state.token);
      state.token = "";
      state.sessionId = "";
      if (!signedIn) await clearPersistedSession().catch(() => {});
      message.textContent = signedIn
        ? "You signed in, but the club could not be loaded. Check your connection and reopen the app."
        : error.message;
    } finally {
      setBusy(form, false);
    }
  });
  byId("back").addEventListener("click", () => show("club-view"));
  byId("open-booking").addEventListener("click", () => openBooking());
  byId("booking-back").addEventListener("click", () => {
    state.rescheduleBooking = null;
    show("dog-view");
  });
  byId("booking-dog").addEventListener("change", () => {
    resetCheckoutAttempt();
    updateBookingSummary();
  });
  byId("booking-service").addEventListener("change", () => {
    resetCheckoutAttempt();
    updateBookingSummary();
  });
  byId("booking-credit").addEventListener("change", updateBookingPaymentNote);
  byId("booking-date").addEventListener("change", resetCheckoutAttempt);
  byId("booking-slots").addEventListener("change", resetCheckoutAttempt);
  byId("booking-payment-refresh").addEventListener(
    "click",
    refreshCheckoutStatus,
  );
  byId("booking-search").addEventListener("click", async () => {
    const message = byId("booking-message");
    message.textContent = "";
    const button = byId("booking-search");
    button.disabled = true;
    clearBookingSlots();
    try {
      const query = new URLSearchParams({
        dog: byId("booking-dog").value,
        service: byId("booking-service").value,
        date: byId("booking-date").value,
      });
      if (state.rescheduleBooking)
        query.set("booking", state.rescheduleBooking.id);
      const availability = await request(
        `/api/mobile/clubs/${encodeURIComponent(state.club.slug)}/availability?${query}`,
      );
      const slots = byId("booking-slots");
      availability.slots.forEach((slot, index) => {
        const label = document.createElement("label");
        label.className = "slot";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "booking-slot";
        input.value = slot.starts_at;
        input.required = true;
        if (index === 0) input.checked = true;
        const copy = document.createElement("span");
        copy.textContent = slot.local_time;
        label.append(input, copy);
        slots.append(label);
      });
      byId("booking-slot-empty").textContent = availability.slots.length
        ? ""
        : "No appointments are available on this date.";
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  byId("booking-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = byId("booking-message");
    const slot = form.querySelector('input[name="booking-slot"]:checked');
    message.textContent = "";
    if (!slot) {
      message.textContent = "Choose an available appointment time.";
      return;
    }
    setBusy(form, true);
    try {
      const rescheduling = state.rescheduleBooking;
      const useCredit =
        !byId("booking-credit-choice").classList.contains("hidden") &&
        byId("booking-credit").checked;
      if (!rescheduling && !useCredit) {
        state.checkoutRequestId ??= crypto.randomUUID();
        const checkout = await request(
          `/api/mobile/clubs/${encodeURIComponent(state.club.slug)}/service-checkouts`,
          {
            method: "POST",
            body: JSON.stringify({
              request_id: state.checkoutRequestId,
              dog_id: byId("booking-dog").value,
              service_id: byId("booking-service").value,
              starts_at: slot.value,
              accepted_terms: "yes",
            }),
          },
        );
        state.pendingCheckout = {
          bookingId: checkout.bookingId,
          expiresAt: checkout.expiresAt,
        };
        byId("booking-payment-refresh").classList.remove("hidden");
        message.textContent =
          "Your appointment is held for 30 minutes while payment completes.";
        await openHostedCheckout(checkout.checkoutUrl);
        return;
      }
      const path = rescheduling
        ? `/api/mobile/clubs/${encodeURIComponent(state.club.slug)}/bookings/${encodeURIComponent(rescheduling.id)}`
        : `/api/mobile/clubs/${encodeURIComponent(state.club.slug)}/bookings`;
      await request(path, {
        method: rescheduling ? "PATCH" : "POST",
        body: JSON.stringify(
          rescheduling
            ? { starts_at: slot.value }
            : {
                dog_id: byId("booking-dog").value,
                service_id: byId("booking-service").value,
                starts_at: slot.value,
                accepted_terms: "yes",
                use_membership_credit: "yes",
              },
        ),
      });
      state.rescheduleBooking = null;
      await openClub(state.club);
      byId("dog-message").textContent = rescheduling
        ? `Appointment moved to ${formatDateTime(slot.value)}.`
        : "Grooming booking confirmed.";
    } catch (error) {
      message.textContent = error.message;
    } finally {
      setBusy(form, false);
      lockRescheduleChoices();
    }
  });
  byId("profile-back").addEventListener("click", async () => {
    clearPhoto();
    state.dog = null;
    await openClub(state.club);
  });
  byId("edit-profile").addEventListener("click", () => {
    byId("edit-name").value = state.dog.name;
    byId("edit-breed").value = state.dog.breed;
    byId("edit-bio").value = state.dog.bio;
    byId("edit-avatar").value = state.dog.avatar;
    byId("edit-audience").value = state.dog.audience;
    byId("edit-message").textContent = "";
    show("edit-view");
  });
  byId("edit-back").addEventListener("click", () => show("profile-view"));
  byId("edit-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = byId("edit-message");
    message.textContent = "";
    setBusy(form, true);
    try {
      await request(
        `/api/mobile/clubs/${encodeURIComponent(state.club.slug)}/dogs/${encodeURIComponent(state.dog.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: byId("edit-name").value,
            breed: byId("edit-breed").value,
            bio: byId("edit-bio").value,
            avatar: byId("edit-avatar").value,
            audience: byId("edit-audience").value,
          }),
        },
      );
      await openDog(state.dog.id);
    } catch (error) {
      message.textContent = error.message;
    } finally {
      setBusy(form, false);
    }
  });
  byId("photo-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const file = byId("photo-file").files[0];
    const message = byId("profile-message");
    message.textContent = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      message.textContent = "Choose a photo no larger than 5 MB.";
      return;
    }
    setBusy(form, true);
    try {
      await changePhoto("PUT", file);
      byId("photo-file").value = "";
      await openDog(state.dog.id);
    } catch (error) {
      message.textContent = error.message;
    } finally {
      setBusy(form, false);
    }
  });
  byId("remove-photo").addEventListener("click", async (event) => {
    if (!confirm("Remove this photograph from the profile?")) return;
    const button = event.currentTarget;
    const message = byId("profile-message");
    message.textContent = "";
    button.disabled = true;
    try {
      await changePhoto("DELETE");
      await openDog(state.dog.id);
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  byId("sign-out").addEventListener("click", () => logout());
  byId("dog-sign-out").addEventListener("click", () => logout());
  byId("profile-sign-out").addEventListener("click", () => logout());
  void restorePersistedSession();
})();
