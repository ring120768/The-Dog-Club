(() => {
  "use strict";
  const state = {
    token: "",
    server: "",
    clubs: [],
    club: null,
    dog: null,
    photoUrl: "",
    bookingOptions: null,
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
  function defaultServer() {
    if (location.protocol === "http:" || location.protocol === "https:")
      return location.origin;
    return platform() === "android"
      ? "http://10.0.2.2:3100"
      : "http://127.0.0.1:3100";
  }
  function show(view) {
    views.forEach((id) => byId(id).classList.toggle("hidden", id !== view));
  }
  function safeServer(value) {
    const url = new URL(value);
    const local = ["127.0.0.1", "10.0.2.2", "localhost"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && local))
      throw new Error(
        "Use an HTTPS server, or a recognised local development address.",
      );
    return url.origin;
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
      logout(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        body.error || "The Dog Club server could not complete that request.",
      );
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
      const payment = booking.groomingCreditsApplied
        ? `${booking.groomingCreditsApplied} membership credit${booking.groomingCreditsApplied === 1 ? "" : "s"}`
        : `£${(booking.amountDuePence / 100).toFixed(2)} due`;
      detail.textContent = `${formatDateTime(booking.startsAt)} · ${payment}`;
      item.append(title, detail);
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
  function updateBookingSummary() {
    const dog = selectedBookingDog();
    const service = selectedBookingService();
    const membership = state.bookingOptions?.membership;
    const canUseCredit = Boolean(
      dog?.canUseMembershipCredits &&
      service?.membershipCreditEligible &&
      membership?.benefitsAvailable &&
      membership.remainingGroomingCredits >= service.membershipCreditCost,
    );
    byId("booking-price").textContent = service
      ? `£${(service.pricePence / 100).toFixed(2)} · ${service.durationMinutes} minutes`
      : "";
    byId("booking-terms").textContent = service?.cancellationTerms ?? "";
    const creditChoice = byId("booking-credit-choice");
    creditChoice.classList.toggle("hidden", !canUseCredit);
    byId("booking-credit").checked = canUseCredit;
    byId("booking-credit-copy").textContent = canUseCredit
      ? `Use ${service.membershipCreditCost} of your ${membership.remainingGroomingCredits} remaining grooming credits`
      : "";
    byId("booking-payment-note").textContent = canUseCredit
      ? "Your selected membership credit covers this booking."
      : service
        ? `£${(service.pricePence / 100).toFixed(2)} will be due at the club. No payment is taken in this demo.`
        : "";
    clearBookingSlots();
  }
  async function openBooking() {
    const message = byId("booking-message");
    message.textContent = "";
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
      byId("booking-date").min = localDateInput();
      byId("booking-date").value = localDateInput(
        new Date(Date.now() + 24 * 60 * 60 * 1000),
      );
      byId("booking-setup-empty").textContent = options.dogs.length
        ? options.services.length
          ? ""
          : "This club has no active grooming services."
        : "No approved dogs are available for grooming bookings.";
      byId("booking-search").disabled =
        !options.dogs.length || !options.services.length;
      byId("booking-terms-accepted").checked = false;
      updateBookingSummary();
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
    state.token = "";
    state.clubs = [];
    state.club = null;
    state.dog = null;
    state.bookingOptions = null;
    clearPhoto();
    show("login-view");
    byId("password").value = "";
    if (notifyServer && token) {
      state.token = token;
      await request("/api/mobile/session", { method: "DELETE" }).catch(
        () => {},
      );
      state.token = "";
    }
  }

  byId("server").value = defaultServer();
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
        }),
      });
      state.token = session.token;
      byId("password").value = "";
      renderClubs(await request("/api/mobile/clubs"));
    } catch (error) {
      state.token = "";
      message.textContent = error.message;
    } finally {
      setBusy(form, false);
    }
  });
  byId("back").addEventListener("click", () => show("club-view"));
  byId("open-booking").addEventListener("click", openBooking);
  byId("booking-back").addEventListener("click", () => show("dog-view"));
  byId("booking-dog").addEventListener("change", updateBookingSummary);
  byId("booking-service").addEventListener("change", updateBookingSummary);
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
      const useCredit =
        !byId("booking-credit-choice").classList.contains("hidden") &&
        byId("booking-credit").checked;
      await request(
        `/api/mobile/clubs/${encodeURIComponent(state.club.slug)}/bookings`,
        {
          method: "POST",
          body: JSON.stringify({
            dog_id: byId("booking-dog").value,
            service_id: byId("booking-service").value,
            starts_at: slot.value,
            accepted_terms: "yes",
            ...(useCredit ? { use_membership_credit: "yes" } : {}),
          }),
        },
      );
      await openClub(state.club);
      byId("dog-message").textContent = "Grooming booking confirmed.";
    } catch (error) {
      message.textContent = error.message;
    } finally {
      setBusy(form, false);
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
})();
