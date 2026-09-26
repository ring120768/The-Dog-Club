export type RuntimeEnvironment = {
  DOGCLUB_DB?: string;
  DOGCLUB_LOCAL_DEMO?: string;
  NODE_ENV?: string;
};

export function isHostedPostgres(
  environment: RuntimeEnvironment = process.env,
) {
  return ["postgres", "supabase"].includes(environment.DOGCLUB_DB ?? "");
}

export function isDemoMode(environment: RuntimeEnvironment = process.env) {
  return (
    environment.DOGCLUB_LOCAL_DEMO === "1" &&
    environment.NODE_ENV !== "production"
  );
}
