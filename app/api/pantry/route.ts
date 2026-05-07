import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * GET /api/pantry — fetch all pantry items for the logged-in user
 * POST /api/pantry — add a new pantry item
 * DELETE /api/pantry?id=xxx — delete a pantry item
 *
 * All operations are server-side — Supabase RLS ensures users
 * can only access their own data even if someone tampers with requests.
 */

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("pantry_items")
    .select("*")
    .eq("user_id", user.id)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const name = (body.name ?? "").trim();
  const quantity = (body.quantity ?? "").trim();
  const category = (body.category ?? "Others").trim();

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Prevent duplicates — case-insensitive check
  const { data: existing } = await supabase
    .from("pantry_items")
    .select("id")
    .eq("user_id", user.id)
    .ilike("name", name)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "Mayroon ka nang ganitong ingredient sa pantry." },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("pantry_items")
    .insert({ user_id: user.id, name, quantity, category })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("pantry_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // Double-check ownership — never trust client

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
