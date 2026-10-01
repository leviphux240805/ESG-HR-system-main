import { db } from "../db";
import { on, paginate } from "../router";

on("GET", "/me", ({ user }) => {
  const record = db().users[user.role];
  return {
    id: `demo-${user.role}`,
    fullName: user.staff.fullName,
    email: user.staff.email,
    phone: user.staff.phone,
    staffId: user.staff.id,
    organization: { id: "demo-org", name: "Mầm Non Việt" },
    roles: record.grants.map((g) => ({ ...g, functionGroups: g.functionGroups ?? [] })),
    schools: db()
      .schools.filter((s) => user.schoolIds.includes(s.id))
      .map(({ id, code, name }) => ({ id, code, name })),
  };
});

const mine = (staffId: string) => db().notifications.filter((n) => n.staffId === staffId);

on("GET", "/notifications", ({ user, query }) => paginate(mine(user.staff.id), query));

on("GET", "/notifications/unread-count", ({ user }) => ({ count: mine(user.staff.id).filter((n) => !n.readAt).length }));

on("POST", "/notifications/read-all", ({ user }) => {
  const list = mine(user.staff.id).filter((n) => !n.readAt);
  list.forEach((n) => (n.readAt = new Date().toISOString()));
  return { updated: list.length };
});

on("POST", "/notifications/{id}/read", ({ user, params }) => {
  const n = mine(user.staff.id).find((x) => x.id === params.id);
  if (n && !n.readAt) n.readAt = new Date().toISOString();
  return n;
});
