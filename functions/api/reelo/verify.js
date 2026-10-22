import { verifyMerchant } from "../../_lib/verify-merchant.js";
export const onRequestPost = ({ env, request }) => verifyMerchant(env, request, null);
