const EMAIL_DOMAIN = "troller.com";

export const convertPhoneToEmail = (phone: string): string => {
  const cleanPhone = phone.replace(/\D/g, "");
  return `${cleanPhone}@${EMAIL_DOMAIN}`;
};

export const extractPhoneFromEmail = (email: string): string => {
  return email.split("@")[0];
};
