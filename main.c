#include <stdio.h>
void stackOverflow() {
    printf("hello");
}
int main() {
    stackOverflow();
    return 0;
}

