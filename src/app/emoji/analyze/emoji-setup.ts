import { Component, inject, signal } from "@angular/core";
import { EmojiService } from "../shared/emoji.service";

@Component({
  imports: [],
  selector: "app-emoji-setup",
  styles: ``,
  template: `
    <article>
      <h2>Emoji Setup</h2>
      <section>
        <p>Analyze emoji assets and create k-d-trees for efficient lookup.</p>
        <button (click)="createKdTree()">Create</button>
      </section>

      <section>
        <h3>Progress</h3>
        <p id="progress">No progress yet.</p>
        <progress id="progress-bar" value="0" max="100" [value]="progress()"></progress>
        <p id="result">{{ result() }}</p>
      </section>
    </article>
  `,
})
export class EmojiSetup {
  service = inject(EmojiService);
  progress = signal(0);
  result = signal("");

  async createKdTree() {
    await this.service.trainKdTree(
      (progress) => {
        this.progress.set(progress);
      },
      (result) => {
        console.log(result);
        this.result.set(result);
      },
    );
  }

  async loadKdTree() {
    await this.service.loadKdTree();
    console.log("Kd-tree loaded successfully.");
  }
}
