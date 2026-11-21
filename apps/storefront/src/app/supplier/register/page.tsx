import type { Metadata } from "next";
import Link from "next/link";
import SupplierRegisterForm from "./supplier-register-form";

export const metadata:Metadata={title:"Supplier application",robots:{index:false,follow:false}};

export default function SupplierRegisterPage(){return <main className="login-page"><div className="login-card supplier-register-card"><Link className="wordmark login-brand" href="/">MAGNI<span>TECH</span><i>®</i></Link><p className="overline">MAGNITECH PARTNERS</p><h1>Apply as a<br/><em>supplier.</em></h1><p className="login-copy">Share your contact and business details. Supplier access begins only after our team approves your application.</p><SupplierRegisterForm/><p className="auth-switch">Already applied? <Link href="/supplier/login">Supplier sign in</Link></p><Link className="login-return" href="/supplier">Supplier information <span>↗</span></Link></div><aside className="login-aside"><span>SUPPLIER ACCESS / APPLICATION</span><p>Good products<br/><em>start with trust.</em></p></aside></main>}
