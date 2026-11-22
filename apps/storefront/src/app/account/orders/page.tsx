import { OrdersView } from "../account-views";
export const metadata = { title: "My orders" };
export default function OrdersPage(){return <><p className="overline">ORDER HISTORY</p><h2>My Orders</h2><OrdersView/></>}
