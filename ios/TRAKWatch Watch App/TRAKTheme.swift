import SwiftUI

enum TRAKColor {
    static let primary     = Color(hex: "a83300")
    static let tertiary    = Color(hex: "006b27")
    static let cardBg      = Color.white.opacity(0.05)
    static let cardBorder  = Color.white.opacity(0.10)
    static let divider     = Color.white.opacity(0.20)
    static let dotInactive = Color.white.opacity(0.20)
}

extension Color {
    init(hex: String) {
        let h = hex.trimmingCharacters(in: .alphanumerics.inverted)
        var value: UInt64 = 0
        Scanner(string: h).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >>  8) & 0xFF) / 255
        let b = Double( value        & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: 1)
    }
}
