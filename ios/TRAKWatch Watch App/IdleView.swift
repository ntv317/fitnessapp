import SwiftUI

struct IdleView: View {
    var body: some View {
        VStack(spacing: 10) {
            HStack {
                Text("TRAK")
                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                    .foregroundColor(TRAKColor.primary)
                Spacer()
            }
            .padding(.horizontal, 8)
            .padding(.top, 6)

            Spacer()

            Image(systemName: "dumbbell.fill")
                .font(.system(size: 28))
                .foregroundColor(TRAKColor.primary)
            Text("Ready")
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(.white)
            Text("Open the app on\nyour iPhone to start")
                .font(.system(size: 12))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Spacer()
        }
        .padding()    }
}
