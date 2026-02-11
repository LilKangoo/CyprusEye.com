declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler: (request: Request) => Response | Promise<Response>): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2.38.4" {
  export const createClient: any;
}

declare module "npm:nodemailer@6.9.11" {
  const nodemailer: any;
  export default nodemailer;
}

declare module "jsr:@negrel/webpush@0.5.0" {
  export const ApplicationServer: any;
  export const PushMessageError: any;
  export const importVapidKeys: any;
  export type ExportedVapidKeys = any;
}
