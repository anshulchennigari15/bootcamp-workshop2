// app/page.js
// Your home page. Replace the placeholder below with your MVP.
import BestTimeToGoForecast from "@/components/BestTimeToGoForecast";
import TinyFishPlayground from "@/components/TinyFishPlayground";

export default function Home() {
  return (
    <main>
      <h1>DevilPulse</h1>
      <p>Find a calmer time to visit ASU campus spots.</p>
      <BestTimeToGoForecast />

      {/* Test panel for your TinyFish key. Remove it once your own UI works. */}
      <TinyFishPlayground />
    </main>
  );
}
