import { defineType, defineField } from "sanity";
// One single document: contact details, address, map and opening hours. The site build copies these into every page.
const time = R => R.required().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { name: "time" }).error("Write the time as 24 hour HH:MM, for example 16:30");
const phone = R => R.required().regex(/^[6-9]\d{9}$/, { name: "phone" }).error("10 digits, no spaces, no +91");
const plain = (max) => R => R.required().max(max).regex(/^[^<>"&\\]+$/, { name: "plain" }).error('Do not use < > " & or \\');
export default defineType({
  name: "siteSettings", title: "Contact, address and hours", type: "document",
  fieldsets: [
    { name: "contact", title: "Contact" }, { name: "address", title: "Address and map" }, { name: "hours", title: "Opening hours (24 hour clock)" },
  ],
  fields: [
    defineField({ name: "phone", title: "Main phone / WhatsApp", description: "10 digits. Used for call and WhatsApp buttons.", type: "string", fieldset: "contact", validation: phone }),
    defineField({ name: "phone2", title: "Second phone (catering)", description: "10 digits.", type: "string", fieldset: "contact", validation: phone }),
    defineField({ name: "email", title: "Order email", type: "string", fieldset: "contact", validation: R => R.required().email() }),
    defineField({ name: "street", title: "Address line", description: "Shown in the footer and in Google data.", type: "string", fieldset: "address", validation: plain(80) }),
    defineField({ name: "areaShort", title: "Short area name", description: "Shown in small places, for example the header.", type: "string", fieldset: "address", validation: plain(40) }),
    defineField({ name: "city", title: "City", type: "string", fieldset: "address", validation: plain(40) }),
    defineField({ name: "postal", title: "PIN code", type: "string", fieldset: "address", validation: R => R.required().regex(/^\d{6}$/, { name: "pin" }).error("6 digits") }),
    defineField({ name: "mapsQuery", title: "Google Maps search text", description: "Exactly what you would type in Google Maps. Letters, numbers, comma, space only.", type: "string", fieldset: "address", validation: R => R.required().max(160).regex(/^[A-Za-z0-9 ,.\-()#\/]+$/, { name: "maps" }).error("Letters, numbers, comma, space only") }),
    defineField({ name: "latitude", title: "Latitude", description: "Right click the place in Google Maps and copy the first number. If you change the address you MUST change this.", type: "number", fieldset: "address", validation: R => R.required().min(-90).max(90) }),
    defineField({ name: "longitude", title: "Longitude", type: "number", fieldset: "address", validation: R => R.required().min(-180).max(180) }),
    defineField({ name: "lunchOpen", title: "Lunch opens", type: "string", fieldset: "hours", validation: time }),
    defineField({ name: "lunchClose", title: "Lunch closes", type: "string", fieldset: "hours", validation: time }),
    defineField({ name: "mondayLunchClose", title: "Lunch closes on Monday", description: "Monday closes earlier today. If every day is the same, write the same time as above.", type: "string", fieldset: "hours", validation: time }),
    defineField({ name: "dinnerOpen", title: "Dinner opens", type: "string", fieldset: "hours", validation: time }),
    defineField({ name: "dinnerClose", title: "Dinner closes", type: "string", fieldset: "hours", validation: time }),
  ],
  preview: { prepare: () => ({ title: "Contact, address and hours" }) },
});
