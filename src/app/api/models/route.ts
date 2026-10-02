import { NextResponse } from "next/server"

const API_KEY = process.env.CALLMISSED_API_KEY

export async function GET() {
  try {
    const response = await fetch("https://api.callmissed.com/v1/models", {
      headers: {
        "Authorization": "Bearer " + API_KEY,
      },
    })

    if (!response.ok) {
      return NextResponse.json({
        data: [
          { id: "sarvam-105b" },
        ],
      })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Models API error:", error)
    return NextResponse.json({
      data: [
        { id: "sarvam-105b" },
      ],
    })
  }
}





