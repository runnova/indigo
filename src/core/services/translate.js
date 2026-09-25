export async function translateTextToEnglish(text) {
    const params = new URLSearchParams({
        client: "gtx",
        sl: "auto",
        tl: "en",
        dt: "t",
        q: text
    })

    const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?${params}`
    )

    if (!response.ok) {
        throw new Error(`Google Translate ${response.status}`)
    }

    const data = await response.json()

    return data[0]
        .map(item => item[0])
        .filter(Boolean)
        .join("")
}
