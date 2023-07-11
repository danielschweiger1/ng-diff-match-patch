import { Directive, Input } from '@angular/core';
import * as i0 from "@angular/core";
import * as i1 from "./diffMatchPatch.service";
class DiffDirective {
    constructor(el, dmp) {
        this.el = el;
        this.dmp = dmp;
        this.left = '';
        this.right = '';
    }
    ngOnInit() {
        this.updateHtml();
    }
    ngOnChanges() {
        this.updateHtml();
    }
    updateHtml() {
        this.el.nativeElement.innerHTML = this.createHtml(this.dmp.getDiff(this.left, this.right));
    }
    createHtml(diffs) {
        let html;
        html = '<div>';
        for (let diff of diffs) {
            diff[1] = diff[1].replace(/\n/g, '<br/>');
            if (diff[0] === 0 /* DiffOp.Equal */) {
                html += '<span class="equal">' + diff[1] + '</span>';
            }
            if (diff[0] === -1 /* DiffOp.Delete */) {
                html += '<del>' + diff[1] + '</del>';
            }
            if (diff[0] === 1 /* DiffOp.Insert */) {
                html += '<ins>' + diff[1] + '</ins>';
            }
        }
        html += '</div>';
        return html;
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "16.1.4", ngImport: i0, type: DiffDirective, deps: [{ token: i0.ElementRef }, { token: i1.DiffMatchPatchService }], target: i0.ɵɵFactoryTarget.Directive }); }
    static { this.ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "14.0.0", version: "16.1.4", type: DiffDirective, selector: "[diff]", inputs: { left: "left", right: "right" }, usesOnChanges: true, ngImport: i0 }); }
}
export { DiffDirective };
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "16.1.4", ngImport: i0, type: DiffDirective, decorators: [{
            type: Directive,
            args: [{
                    selector: '[diff]'
                }]
        }], ctorParameters: function () { return [{ type: i0.ElementRef }, { type: i1.DiffMatchPatchService }]; }, propDecorators: { left: [{
                type: Input
            }], right: [{
                type: Input
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlmZi5kaXJlY3RpdmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9wcm9qZWN0cy9uZy1kaWZmLW1hdGNoLXBhdGNoL3NyYy9saWIvZGlmZi5kaXJlY3RpdmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFNBQVMsRUFBYyxLQUFLLEVBQXFCLE1BQU0sZUFBZSxDQUFDOzs7QUFJaEYsTUFHYSxhQUFhO0lBS3hCLFlBQ1UsRUFBYyxFQUNkLEdBQTBCO1FBRDFCLE9BQUUsR0FBRixFQUFFLENBQVk7UUFDZCxRQUFHLEdBQUgsR0FBRyxDQUF1QjtRQUwzQixTQUFJLEdBQVcsRUFBRSxDQUFDO1FBQ2xCLFVBQUssR0FBVyxFQUFFLENBQUM7SUFJYSxDQUFDO0lBRW5DLFFBQVE7UUFDYixJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7SUFDcEIsQ0FBQztJQUVNLFdBQVc7UUFDaEIsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBQ3BCLENBQUM7SUFFTyxVQUFVO1FBQ2hCLElBQUksQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUMvQyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFTyxVQUFVLENBQUMsS0FBa0I7UUFDbkMsSUFBSSxJQUFZLENBQUM7UUFDakIsSUFBSSxHQUFHLE9BQU8sQ0FBQztRQUNmLEtBQUksSUFBSSxJQUFJLElBQUksS0FBSyxFQUFFO1lBQ3JCLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztZQUUxQyxJQUFHLElBQUksQ0FBQyxDQUFDLENBQUMseUJBQWlCLEVBQUU7Z0JBQzNCLElBQUksSUFBSSxzQkFBc0IsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDO2FBQ3REO1lBQ0QsSUFBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLDJCQUFrQixFQUFFO2dCQUM1QixJQUFJLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUM7YUFDdEM7WUFDRCxJQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsMEJBQWtCLEVBQUU7Z0JBQzVCLElBQUksSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQzthQUN0QztTQUNGO1FBQ0QsSUFBSSxJQUFJLFFBQVEsQ0FBQztRQUNqQixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7OEdBeENVLGFBQWE7a0dBQWIsYUFBYTs7U0FBYixhQUFhOzJGQUFiLGFBQWE7a0JBSHpCLFNBQVM7bUJBQUM7b0JBQ1QsUUFBUSxFQUFFLFFBQVE7aUJBQ25CO3FJQUdVLElBQUk7c0JBQVosS0FBSztnQkFDRyxLQUFLO3NCQUFiLEtBQUsiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEaXJlY3RpdmUsIEVsZW1lbnRSZWYsIElucHV0LCBPbkluaXQsIE9uQ2hhbmdlcyB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgRGlmZk1hdGNoUGF0Y2hTZXJ2aWNlIH0gZnJvbSAnLi9kaWZmTWF0Y2hQYXRjaC5zZXJ2aWNlJztcbmltcG9ydCB7IERpZmYsIERpZmZPcCB9IGZyb20gJy4vZGlmZk1hdGNoUGF0Y2gnO1xuXG5ARGlyZWN0aXZlKHtcbiAgc2VsZWN0b3I6ICdbZGlmZl0nXG59KVxuZXhwb3J0IGNsYXNzIERpZmZEaXJlY3RpdmUgaW1wbGVtZW50cyBPbkluaXQsIE9uQ2hhbmdlcyB7XG5cbiAgQElucHV0KCkgbGVmdDogc3RyaW5nID0gJyc7XG4gIEBJbnB1dCgpIHJpZ2h0OiBzdHJpbmcgPSAnJztcblxuICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBlbDogRWxlbWVudFJlZixcbiAgICBwcml2YXRlIGRtcDogRGlmZk1hdGNoUGF0Y2hTZXJ2aWNlKSB7ICB9XG5cbiAgcHVibGljIG5nT25Jbml0KCk6IHZvaWQge1xuICAgIHRoaXMudXBkYXRlSHRtbCgpO1xuICB9XG5cbiAgcHVibGljIG5nT25DaGFuZ2VzKCk6IHZvaWQge1xuICAgIHRoaXMudXBkYXRlSHRtbCgpO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVIdG1sKCk6IHZvaWQge1xuICAgIHRoaXMuZWwubmF0aXZlRWxlbWVudC5pbm5lckhUTUwgPSB0aGlzLmNyZWF0ZUh0bWwoXG4gICAgICB0aGlzLmRtcC5nZXREaWZmKHRoaXMubGVmdCwgdGhpcy5yaWdodCkpO1xuICB9XG4gIFxuICBwcml2YXRlIGNyZWF0ZUh0bWwoZGlmZnM6IEFycmF5PERpZmY+KTogc3RyaW5nIHtcbiAgICBsZXQgaHRtbDogc3RyaW5nO1xuICAgIGh0bWwgPSAnPGRpdj4nO1xuICAgIGZvcihsZXQgZGlmZiBvZiBkaWZmcykge1xuICAgICAgZGlmZlsxXSA9IGRpZmZbMV0ucmVwbGFjZSgvXFxuL2csICc8YnIvPicpO1xuXG4gICAgICBpZihkaWZmWzBdID09PSBEaWZmT3AuRXF1YWwpIHtcbiAgICAgICAgaHRtbCArPSAnPHNwYW4gY2xhc3M9XCJlcXVhbFwiPicgKyBkaWZmWzFdICsgJzwvc3Bhbj4nO1xuICAgICAgfVxuICAgICAgaWYoZGlmZlswXSA9PT0gRGlmZk9wLkRlbGV0ZSkge1xuICAgICAgICBodG1sICs9ICc8ZGVsPicgKyBkaWZmWzFdICsgJzwvZGVsPic7XG4gICAgICB9XG4gICAgICBpZihkaWZmWzBdID09PSBEaWZmT3AuSW5zZXJ0KSB7XG4gICAgICAgIGh0bWwgKz0gJzxpbnM+JyArIGRpZmZbMV0gKyAnPC9pbnM+JztcbiAgICAgIH1cbiAgICB9XG4gICAgaHRtbCArPSAnPC9kaXY+JztcbiAgICByZXR1cm4gaHRtbDtcbiAgfVxufVxuIl19