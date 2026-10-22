import { verifyMerchant } from "../../../../_lib/verify-merchant.js";
export const onRequestPost = ({ env, request, params }) => verifyMerchant(env, request, params.vendor);
