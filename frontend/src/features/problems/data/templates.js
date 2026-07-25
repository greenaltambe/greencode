export const templates = {
  cpp: `#include <iostream>
using namespace std;

int main() {
    // Write your solution here
    int n;
    if (cin >> n) {
        cout << n * 2 << endl;
    }
    return 0;
}`,
  java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        // Write your solution here
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) {
            int n = sc.nextInt();
            System.out.println(n * 2);
        }
    }
}`,
  python: `# Write your solution here
import sys

for line in sys.stdin:
    val = line.strip()
    if val:
        print(int(val) * 2)
`,
};
